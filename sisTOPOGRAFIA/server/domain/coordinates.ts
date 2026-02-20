export class LatLonCoordinate {
    constructor(
        public readonly latitude: number,
        public readonly longitude: number
    ) {
        if (latitude < -90 || latitude > 90) throw new Error("Invalid latitude");
        if (longitude < -180 || longitude > 180) throw new Error("Invalid longitude");
    }

    equals(other: LatLonCoordinate): boolean {
        return Math.abs(this.latitude - other.latitude) < 0.00001 &&
            Math.abs(this.longitude - other.longitude) < 0.00001;
    }
}

export class UTMCoordinate {
    constructor(
        public readonly zone: string,
        public readonly easting: number,
        public readonly northing: number
    ) {
        if (!/^[0-9]{1,2}[A-Z]$/.test(zone)) throw new Error("Invalid UTM Zone");
        if (easting <= 0) throw new Error("Invalid easting");
        if (northing <= 0) throw new Error("Invalid northing");
    }

    equals(other: UTMCoordinate): boolean {
        return this.zone === other.zone &&
            this.easting === other.easting &&
            this.northing === other.northing;
    }
}
