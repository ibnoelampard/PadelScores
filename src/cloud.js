import { createEmptyState } from './storage.js';
import { readRecovery, writeRecovery } from './backup.js';
const copy = value => structuredClone(value);
export class CloudSession {
  constructor({repository,storage,onChange=()=>{},delay=500}) {
    Object.assign(this,{repository,storage,onChange,delay,user:null,state:createEmptyState(),revision:0,status:'signedOut',dirty:false,recovery:null,error:null,generation:0,editVersion:0,localWarning:false});
  }
  notify(reason='status') {this.onChange(this,reason);}
  remember() {
    try {writeRecovery(this.storage,this.user.id,this.dirty?{revision:this.revision,state:this.state}:null);this.localWarning=false;}
    catch {this.localWarning=true;}
  }
  async connect(user) {
    const generation=++this.generation;clearTimeout(this.timer);
    this.running=null;this.refreshing=null;this.user=user;this.state=createEmptyState();this.revision=0;this.dirty=false;this.error=null;
    this.recovery=user?readRecovery(this.storage,user.id):null;this.status=user?'loading':'signedOut';this.notify('data');
    if (!user) return;
    try {
      const remote=await this.repository.load(user.id);
      if(generation!==this.generation) return;
      this.state=remote.state;this.revision=remote.revision;this.status='ready';this.notify('data');
    } catch(error) {if(generation===this.generation){this.error=error;this.status='error';this.notify('data');}}
  }
  edit(state) {
    if (!this.user || !['ready','saving'].includes(this.status) || this.recovery) return false;
    this.state=state;this.dirty=true;this.editVersion++;this.remember();this.notify();
    clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),this.delay);return true;
  }
  flush() {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    if(!this.user || !this.dirty || !['ready','saving'].includes(this.status)) return Promise.resolve();
    const generation=this.generation;
    const run=async()=>{
      while(this.dirty && generation===this.generation) {
        const version=this.editVersion;const pending=copy(this.state);const uid=this.user.id;
        this.status='saving';this.notify();
        try {
          const result=await this.repository.save(pending,this.revision,uid);
          if(generation!==this.generation) return;
          this.revision=result.revision;this.dirty=this.editVersion!==version;this.remember();
        } catch(error) {
          if(generation!==this.generation) return;
          this.error=error;this.status=String(error.message).includes('revision_conflict')?'conflict':'error';this.remember();this.notify();return;
        }
      }
      if(generation===this.generation){this.status='ready';this.error=null;this.notify();}
    };
    this.running=run().finally(()=>{if(generation===this.generation)this.running=null;});return this.running;
  }
  async refresh() {
    if(!this.user || this.status==='loading' || this.status==='conflict') return;
    if(this.running){await this.running;if(this.running) return;}
    if(this.refreshing) return this.refreshing;
    const generation=this.generation;
    const refreshRevision=this.revision;
    const refreshVersion=this.editVersion;
    const task=async()=>{
      try {
        const remote=await this.repository.load(this.user.id);
        if(generation!==this.generation || this.running || remote.revision < this.revision) return;
        if(remote.revision===this.revision) return;
        if(this.dirty){this.status='conflict';this.notify();return;}
        this.state=remote.state;this.revision=remote.revision;this.status='ready';this.error=null;this.notify('data');
      }catch(error){if(generation===this.generation && refreshRevision===this.revision && refreshVersion===this.editVersion && !this.running){this.error=error;this.status='error';this.notify();}}
    };
    this.refreshing=task().finally(()=>{if(generation===this.generation)this.refreshing=null;});return this.refreshing;
  }
  async retry() {
    if(this.status==='conflict') return;
    if(!this.dirty) return this.connect(this.user);
    this.status='ready';await this.refresh();if(this.status==='ready')return this.flush();
  }
  async discardAndReload() {
    if(this.running) await this.running;
    // Keep recovery on disk until reload succeeds so a network failure cannot lose it.
    const uid=this.user?.id;
    await this.connect(this.user);
    if(this.status==='ready' && this.user?.id===uid){this.recovery=null;this.remember();this.notify('data');}
  }
  restoreRecovery() {
    if(!this.recovery || this.status!=='ready') return;
    const recovery=this.recovery;this.recovery=null;this.state=copy(recovery.state);this.dirty=true;this.editVersion++;
    this.status=recovery.revision===this.revision?'ready':'conflict';
    if(this.status==='conflict')this.revision=recovery.revision;
    this.remember();this.notify('data');if(this.status==='ready')void this.flush();
  }
  dispose(){++this.generation;clearTimeout(this.timer);}
}
