const KEY='current.progress.v1';
const defaults={unlocked:1,stars:{}};
export function loadProgress(storage=localStorage){try{return{...defaults,...JSON.parse(storage.getItem(KEY)||'{}')}}catch{return structuredClone(defaults)}}
export function saveResult(level,stars,storage=localStorage){const progress=loadProgress(storage);progress.unlocked=Math.max(progress.unlocked,Math.min(level+1,4));progress.stars[level]=Math.max(progress.stars[level]||0,stars);storage.setItem(KEY,JSON.stringify(progress));return progress}
