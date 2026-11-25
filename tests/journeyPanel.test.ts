import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JourneyPanel} from '../src/components/JourneyPanel';
import {DemoSim} from '../src/services/demoSim';
import {computeOnboard,DelayTracker} from '../src/services/onboard';
it('shows a strong critical alert only for observed delay, and labels the next stop and estimate clearly',()=>{
 const snapshot=new DemoSim(25).snapshot(0),model=computeOnboard({...snapshot,tracker:new DelayTracker(),connection:'demo'});
 const view=(kind:'estimate'|'observed')=>renderToStaticMarkup(createElement(JourneyPanel,{model:{...model,delayMin:25,delayKind:kind},train:snapshot.train,updatedAt:null}));
 const estimate=view('estimate'),observed=view('observed');
 expect(estimate).toContain('data-severity="unknown"');expect(estimate).toContain('předběžný údaj');expect(estimate).not.toContain('data-severity="critical"');
 expect(observed).toContain('data-severity="critical"');expect(observed).toContain('+25 min');expect(observed).toContain('Výrazné zpoždění');
 expect(observed).toContain('next-station');expect(observed).toContain('Sosnowiec Główny');
});
