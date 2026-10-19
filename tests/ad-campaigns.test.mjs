import {test} from 'node:test';
import assert from 'node:assert/strict';
import {amountDue,campaignStatus,cleanCampaign,cleanSettings,eligible,pickCampaign} from '../lib/ad-campaigns.ts';
const base={name:'A',url:'https://cdn.example/a.mp4',weight:1};
const make=(over={},id='a')=>{const c=cleanCampaign({...base,...over},id,1);if('error' in c)throw Error(c.error);return c;};
test('campaign input is validated and clamped',()=>{
 assert.match(cleanCampaign({...base,name:''},'x').error,/nome/);
 assert.match(cleanCampaign({...base,url:'http://insecure/a.mp4'},'x').error,/https/);
 assert.match(cleanCampaign({...base,url:'https://a/"><script>'},'x').error,/https/);
 assert.match(cleanCampaign({...base,startsAt:'2026-02-01',endsAt:'2026-01-01'},'x').error,/anterior/);
 const c=make({weight:500,skipAfter:99,cpm:'12.345',kind:'other'});
 assert.deepEqual([c.weight,c.skipAfter,c.cpm,c.kind,c.active],[100,30,12.35,'video',true]);
 assert.deepEqual(cleanSettings({minutesBetween:-5,defaultSkip:90}),{enabled:true,minutesBetween:0,defaultSkip:30});
});
test('eligibility follows pause, dates and impression cap',()=>{
 assert.equal(eligible(make({active:false}),0,'2026-10-19'),false);
 assert.equal(eligible(make({startsAt:'2026-10-20'}),0,'2026-10-19'),false);
 assert.equal(eligible(make({endsAt:'2026-10-18'}),0,'2026-10-19'),false);
 assert.equal(eligible(make({startsAt:'2026-10-19',endsAt:'2026-10-19'}),0,'2026-10-19'),true);
 assert.equal(eligible(make({maxImpressions:10}),10,'2026-10-19'),false);
 assert.equal(campaignStatus(make({maxImpressions:10}),10,'2026-10-19'),'Meta atingida');
});
test('weighted draw picks by share and skips ineligible campaigns',()=>{
 const list=[make({weight:1},'a'),make({weight:3},'b'),make({active:false,weight:50},'c')];
 assert.equal(pickCampaign(list,{},'2026-10-19',()=>0.1).id,'a');
 assert.equal(pickCampaign(list,{},'2026-10-19',()=>0.3).id,'b');
 assert.equal(pickCampaign(list,{},'2026-10-19',()=>0.999).id,'b');
 assert.equal(pickCampaign([list[2]],{},'2026-10-19'),null);
 const seen={a:0,b:0};let r=0;for(let i=0;i<4000;i++)seen[pickCampaign(list,{},'2026-10-19',()=>(r=(r*9301+49297)%233280)/233280).id]++;
 assert.ok(seen.b/seen.a>2.5&&seen.b/seen.a<3.5);
});
test('amount due is impressions times price per thousand',()=>{assert.equal(amountDue(2500,20),50);assert.equal(amountDue(1,15),0.02);});
