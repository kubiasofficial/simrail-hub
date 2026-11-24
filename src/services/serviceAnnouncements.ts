// Only file identifiers and UI labels. Personal audio stays outside the application.
export const SERVICE_ANNOUNCEMENTS = {
 welcome: {file:'vitejte.wav',label:'Uvítání'},
 delay: {file:'zpozdeni.wav',label:'Omluva za zpoždění'},
 departure_wait: {file:'cekani_na_odjezd.wav',label:'Čekání na odjezd'},
 track_wait: {file:'pobyt_na_trati.wav',label:'Pobyt na trati'},
 luggage: {file:'zavazadla.wav',label:'Zavazadla'},
 clear_aisles: {file:'volne_ulicky.wav',label:'Volné uličky'},
 exit: {file:'vystupovani.wav',label:'Vystupování / dveře'},
 terminal: {file:'konecna.wav',label:'Konečná stanice'},
 stay_onboard: {file:'nevystupujte.wav',label:'Nevystupujte'}
} as const;
export type ServiceAnnouncementId=keyof typeof SERVICE_ANNOUNCEMENTS;
export function isServiceAnnouncementId(value:unknown):value is ServiceAnnouncementId {
 return typeof value==='string'&&Object.hasOwn(SERVICE_ANNOUNCEMENTS,value);
}
export interface ServiceRecordingStatus {id:ServiceAnnouncementId;label:string;available:boolean}
