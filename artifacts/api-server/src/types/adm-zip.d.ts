declare module "adm-zip" {
  export default class AdmZip {
    constructor(buffer?: Buffer | string);
    getEntries(): Array<{ entryName: string; getData(): Buffer }>;
    extractAllTo(targetPath: string, overwrite?: boolean): void;
  }
}
