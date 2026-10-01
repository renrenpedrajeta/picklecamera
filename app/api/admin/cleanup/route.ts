import {getAccount} from '@/lib/auth';
import {json} from '@/lib/http';
import {recorderDatabase} from '@/lib/recorder-server';
export async function GET() {
 const {account}=await getAccount();
 if(account?.role!=='admin') return json({error:'Administrator access required.'},403);
 const result=await recorderDatabase().from('cleanup_jobs').select('file_id,status,attempts,safe_error,next_attempt_at,cloud_deleted_at,local_deleted_at,recording_files(session_id,expires_at)').order('created_at',{ascending:false}).limit(50);
 return result.error?json({error:'Cleanup status unavailable.'},503):json({jobs:result.data});
}
