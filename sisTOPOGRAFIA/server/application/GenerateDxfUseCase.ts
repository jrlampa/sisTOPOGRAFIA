import { createCacheKey, getCachedFilename, deleteCachedFilename } from '../services/cacheServiceFirestore.js';
import { createDxfTask } from '../services/cloudTasksService.js';
import { createJob } from '../services/jobStatusServiceFirestore.js';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { DxfGenerationRequest } from '../interfaces/schemas/dxfSchema.js';

export class GenerateDxfUseCase {
    constructor(
        private readonly dxfDirectory: string,
        private readonly getBaseUrl: (req?: any) => string
    ) { }

    async execute(data: DxfGenerationRequest, req: any): Promise<{ status: number, data: any }> {
        const { lat, lon, radius, mode, utm } = data;
        const resolvedMode = mode || 'circle';
        const polygon = data.polygon;
        const layers = data.layers;
        const projection = data.projection ?? 'local';

        // Prepare latitude and longitude if UTM was provided and mode is utm (to be handled later by python script conversion, Python script will need to understand the mode 'utm')
        const cacheKey = createCacheKey({
            lat: lat ?? (utm ? utm.northing : 0),
            lon: lon ?? (utm ? utm.easting : 0),
            radius,
            mode: resolvedMode,
            polygon: typeof polygon === 'string' ? polygon : polygon ?? null,
            layers: layers ?? {}
        });

        const cachedFilename = await getCachedFilename(cacheKey);
        if (cachedFilename) {
            const cachedFilePath = path.join(this.dxfDirectory, cachedFilename);
            if (fs.existsSync(cachedFilePath)) {
                const baseUrl = this.getBaseUrl(req);
                const cachedUrl = `${baseUrl}/downloads/${cachedFilename}`;
                logger.info('DXF cache hit', {
                    cacheKey,
                    filename: cachedFilename,
                    ip: req.ip
                });
                return {
                    status: 200,
                    data: {
                        status: 'success',
                        message: 'DXF Generated',
                        url: cachedUrl
                    }
                };
            }

            await deleteCachedFilename(cacheKey);
            logger.warn('DXF cache entry missing file', {
                cacheKey,
                filename: cachedFilename,
                ip: req.ip
            });
        }

        const baseUrl = this.getBaseUrl(req);
        const filename = `dxf_${Date.now()}.dxf`;
        const outputFile = path.join(this.dxfDirectory, filename);
        const downloadUrl = `${baseUrl}/downloads/${filename}`;

        logger.info('Queueing DXF generation', {
            lat,
            lon,
            utm,
            radius,
            mode: resolvedMode,
            projection,
            cacheKey
        });

        // Add 'utm_zone' strictly if utm is present
        const pythonTaskArgs: any = {
            lat: lat ?? 0,
            lon: lon ?? 0,
            radius,
            mode: resolvedMode,
            polygon: typeof polygon === 'string' ? polygon : JSON.stringify(polygon || []),
            layers: layers || {},
            projection,
            outputFile,
            filename,
            cacheKey,
            downloadUrl
        };

        if (utm) {
            pythonTaskArgs.utm_zone = utm.zone;
            pythonTaskArgs.utm_easting = utm.easting;
            pythonTaskArgs.utm_northing = utm.northing;
        }

        const { taskId, alreadyCompleted } = await createDxfTask(pythonTaskArgs);

        if (!alreadyCompleted) {
            await createJob(taskId);
        }

        const responseStatus = alreadyCompleted ? 'success' : 'queued';
        return {
            status: alreadyCompleted ? 200 : 202,
            data: {
                status: responseStatus,
                jobId: taskId,
                ...(alreadyCompleted && {
                    url: downloadUrl,
                    message: 'DXF generated immediately in development mode'
                })
            }
        };
    }
}
