import {
  buildCqtParityReportSuite,
  isCqtParitySuiteComplete,
} from "../services/cqtParityReportService";
import { buildCanonicalCqtRuntimeSnapshots } from "../services/cqtRuntimeSnapshotService";
import { CQT_PARITY_WORKBOOK_FIXTURE } from "./fixtures/cqtParityWorkbookFixture";

describe("cqtRuntimeSnapshotService.buildCanonicalCqtRuntimeSnapshots", () => {
  it("produces runtime snapshots for atual, proj1 and proj2", () => {
    const snapshots = buildCanonicalCqtRuntimeSnapshots();

    expect(snapshots.atual).toBeDefined();
    expect(snapshots.proj1).toBeDefined();
    expect(snapshots.proj2).toBeDefined();
  });

  it("matches workbook parity expectations across all canonical scenarios", () => {
    const suite = buildCqtParityReportSuite(
      buildCanonicalCqtRuntimeSnapshots(),
    );

    expect(suite.totals.scenarios).toBe(3);
    expect(suite.totals.complete).toBe(3);
    expect(suite.totals.partial).toBe(0);
    expect(suite.totals.missing).toBe(0);
    expect(suite.totals.compared).toBe(11);
    expect(suite.totals.failed).toBe(0);
    expect(suite.totals.passed).toBe(11);
    expect(isCqtParitySuiteComplete(suite)).toBe(true);
  });

  it("reproduces the workbook fixture values for all compared cells", () => {
    const snapshots = buildCanonicalCqtRuntimeSnapshots();

    expect(snapshots.atual).toMatchObject(CQT_PARITY_WORKBOOK_FIXTURE.atual);
    expect(snapshots.proj1).toMatchObject(CQT_PARITY_WORKBOOK_FIXTURE.proj1);
    expect(snapshots.proj2).toMatchObject(CQT_PARITY_WORKBOOK_FIXTURE.proj2);
  });
});
