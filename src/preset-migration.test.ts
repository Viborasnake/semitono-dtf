import {test} from 'node:test'
import assert from 'node:assert/strict'
import {migratePresetSettings} from './preset-migration.ts'
test('legacy presets gain missing fields without overwriting user settings',()=>{
 const old={lpi:35,autoToneStrength:0,solidAlpha:false}
 const defaults={cornerRadiusMm:0,autoToneStrength:100,solidAlpha:true,temperature:0}
 const migrated=migratePresetSettings(old,defaults)
 assert.equal(migrated.cornerRadiusMm,0);assert.equal(migrated.temperature,0)
 assert.equal(migrated.autoToneStrength,0);assert.equal(migrated.solidAlpha,false)
 assert.equal(migrated.lpi,35);assert.equal('cornerRadiusMm' in old,false)
})
test('invalid supplied values remain invalid for validation to reject',()=>{
 assert.equal(migratePresetSettings({cornerRadiusMm:-3},{cornerRadiusMm:0}).cornerRadiusMm,-3)
 assert.equal(migratePresetSettings({autoTone:null},{autoTone:false}).autoTone,null)
})
