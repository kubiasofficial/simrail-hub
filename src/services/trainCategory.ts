import type {Train} from '../types/trains';
import {isFreightTrain} from './trainPurpose';
export const CATEGORIES={
 EC:{key:'EC',label:'EC',color:'#087f91'},EIC:{key:'EIC',label:'EIC',color:'#4655b8'},
 EIP:{key:'EIP',label:'EIP',color:'#7542b7'},IC:{key:'IC',label:'IC',color:'#2265af'},
 TLK:{key:'TLK',label:'TLK',color:'#9c711f'},R:{key:'R',label:'R',color:'#19785a'},
 freight:{key:'freight',label:'Nákladní',color:'#596b7d'},unknown:{key:'unknown',label:'',color:'#596b7d'}
} as const;
export function trainCategory(train:Pick<Train,'name'|'vehicles'>){
 if(isFreightTrain(train)||/\b(?:CARGO|FREIGHT|TOWAROWY)\b/i.test(train.name??''))return CATEGORIES.freight;
 const words:string[]=(train.name??'').toUpperCase().match(/[A-Z]+/g)??[];
 for(const key of ['EIP','EIC','EC','IC','TLK'] as const)if(words.includes(key))return CATEGORIES[key];
 // PKP PLK train-type codes: branding (IC/TLK/EIP) takes precedence above.
 if(words.some(w=>/^EC[EJSM]$/.test(w)))return CATEGORIES.EC;
 if(words.some(w=>/^EI[EJSM]$/.test(w)))return CATEGORIES.EIC;
 if(words.some(w=>/^(?:MO[EJSM]|MA[JM]|RO[PEJSM]|RP[PEJSM]|RA[EJSM]|RM[PEJSM]|AM[JM]|AP[JM])$/.test(w)))return CATEGORIES.R;
 if(words.some(w=>['R','REG','REGIO','OS','IR'].includes(w)))return CATEGORIES.R;
 return CATEGORIES.unknown;
}
