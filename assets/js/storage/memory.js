export class MemoryStorage{
  constructor(){this.state=null;this.events=[];this.playerProfiles=new Map();}
  async getState(){return this.state?structuredClone(this.state):null;}
  async saveState(state){this.state=structuredClone(state);}
  async addSyncEvent(event){this.events.push(structuredClone(event));}
  async getSyncEvents(){return structuredClone(this.events);}
  async updateSyncEvent(id,patch){const e=this.events.find(e=>e.id===id);if(e)Object.assign(e,patch);}
  async getPlayerProfile(memberCode){return this.playerProfiles.has(memberCode)?structuredClone(this.playerProfiles.get(memberCode)):null;}
  async savePlayerProfile(memberCode,profile){this.playerProfiles.set(memberCode,{memberCode,profile:structuredClone(profile),cachedAt:new Date().toISOString()});}
  async replaceSyncEvents(events){this.events=structuredClone(events);}
}
