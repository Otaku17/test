export namespace main {
	
	export class GameItem {
	    dbSymbol: string;
	    name?: string;
	    icon?: string;
	    id?: number;
	
	    static createFrom(source: any = {}) {
	        return new GameItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dbSymbol = source["dbSymbol"];
	        this.name = source["name"];
	        this.icon = source["icon"];
	        this.id = source["id"];
	    }
	}
	export class ProjectData {
	    projectName: string;
	    projectIconUrl: string;
	    configJSON: string;
	    items: GameItem[];
	    itemIcons: Record<string, string>;
	    itemNames: Record<string, string>;
	    csvText: string;
	    hasCsv: boolean;
	    hasConfig: boolean;
	    warnings: string[];
	
	    static createFrom(source: any = {}) {
	        return new ProjectData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.projectName = source["projectName"];
	        this.projectIconUrl = source["projectIconUrl"];
	        this.configJSON = source["configJSON"];
	        this.items = this.convertValues(source["items"], GameItem);
	        this.itemIcons = source["itemIcons"];
	        this.itemNames = source["itemNames"];
	        this.csvText = source["csvText"];
	        this.hasCsv = source["hasCsv"];
	        this.hasConfig = source["hasConfig"];
	        this.warnings = source["warnings"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpdateInfo {
	    currentVersion: string;
	    latestVersion: string;
	    hasUpdate: boolean;
	    updateURL: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.hasUpdate = source["hasUpdate"];
	        this.updateURL = source["updateURL"];
	    }
	}

}

