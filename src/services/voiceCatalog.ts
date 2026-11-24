export interface VoiceInfo { id: string; label: string; lang: 'cs'|'pl';sha256:string;configSha256:string; onnxUrl: string; jsonUrl: string; sizeMB: number; license: string }

const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/cs/cs_CZ/jirka';
/** Katalog hlasů – jen ověřené české modely. Licence viz MODEL_CARD v repozitáři rhasspy/piper-voices. */
export const VOICES: VoiceInfo[] = [
  { id: 'cs_CZ-jirka-medium', label: 'Čeština – Jirka (střední kvalita, 22 kHz)', lang: 'cs',sha256:'cbd5c900acacc8e8cbecd64347abb8de39c00a9d3104bed06fee92e4f319efc8',configSha256:'fb38b1799b7354808227c065efa97b1ffa2b0cde59505babb56a36d35af9c637', sizeMB: 63, license: 'Dataset CC0 (NabuCasa/voice-datasets); model dolaďován z anglického hlasu „lessac“ – před komerčním použitím ověřte licenci základního modelu.', onnxUrl: `${HF}/medium/cs_CZ-jirka-medium.onnx`, jsonUrl: `${HF}/medium/cs_CZ-jirka-medium.onnx.json` },
  { id: 'cs_CZ-jirka-low', label: 'Čeština – Jirka (nižší kvalita, 16 kHz, rychlejší)', lang: 'cs',sha256:'72e73fb306a165b41927d2c9d882f71e9f1c86ac5edf37c5441370a6e4e6ef7d',configSha256:'fc32d8cdd23a6461fdd355de422daad6271cbf15033b754343b8a9262cca1f76', sizeMB: 63, license: 'Dataset CC0 (NabuCasa/voice-datasets); model dolaďován z anglického hlasu „lessac“ – před komerčním použitím ověřte licenci základního modelu.', onnxUrl: `${HF}/low/cs_CZ-jirka-low.onnx`, jsonUrl: `${HF}/low/cs_CZ-jirka-low.onnx.json` },
  {id:'pl_PL-darkman-medium',label:'Polština – Darkman (střední kvalita, 22 kHz)',lang:'pl',sizeMB:63,license:'Dataset CC0 (NabuCasa); doladěno z lessac. Viz MODEL_CARD.',onnxUrl:'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pl/pl_PL/darkman/medium/pl_PL-darkman-medium.onnx',jsonUrl:'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pl/pl_PL/darkman/medium/pl_PL-darkman-medium.onnx.json',sha256:'db505438a5364e8e2e0242c4324130a873ed660dfbe8d9689cef428ffb1b645f',configSha256:'70f999f11fa8ad13d3ef779041ee93c9f38be5abdbacdfad42449712fe91c81b'}
];

/** Binárka Piper 2023.11.14-2 pro Windows (MIT). SHA-256 jsme spočítali ze staženého archivu. */
export const PIPER_PACKAGE = {
  url: 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip',
  sha256: 'f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efcea'
};

export function voiceForLanguage(lang:'cs'|'pl',selected:string){return VOICES.find(v=>v.id===selected&&v.lang===lang)?.id??VOICES.find(v=>v.lang===lang)!.id;}
