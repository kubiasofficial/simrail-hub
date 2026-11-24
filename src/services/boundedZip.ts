import {Unzip,UnzipInflate} from 'fflate';
/** Stream compressed input in small chunks and count actual output before retaining it. */
export function boundedUnzip(bytes:Uint8Array,maxBytes:number,maxEntries:number):Record<string,Uint8Array>{
 const files:Record<string,Uint8Array>=Object.create(null);let count=0,total=0;const seen=new Set<string>();let completed=0;
 const unzip=new Unzip(file=>{
  if(++count>maxEntries||seen.has(file.name))throw Error('ZIP obsahuje příliš mnoho nebo duplicitní položky.');
  seen.add(file.name);const chunks:Uint8Array[]=[];let length=0;
  file.ondata=(error,data,final)=>{if(error)throw error;total+=data.length;length+=data.length;if(total>maxBytes)throw Error('Obsah ZIP je po rozbalení příliš velký.');
   chunks.push(data);if(final){const output=new Uint8Array(length);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}files[file.name]=output;completed++;}
  };file.start();
 });unzip.register(UnzipInflate);
 for(let offset=0;offset<bytes.length;offset+=1024)unzip.push(bytes.subarray(offset,offset+1024),offset+1024>=bytes.length);
 if(!count||completed!==count)throw Error('ZIP není úplný.');return files;
}
