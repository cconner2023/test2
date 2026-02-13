import type { Component } from './User';

export interface UnitNode {
    name: string;
    uic?: string;
    children?: UnitNode[];
}

// ---------------------------------------------------------------------------
// Company / Troop / Battery level — leaf-node templates
// ---------------------------------------------------------------------------

const standardCompanies: UnitNode[] = [
    { name: 'HHC' }, { name: 'A Company' }, { name: 'B Company' }, { name: 'C Company' },
];

const infantryCompanies: UnitNode[] = [
    { name: 'HHC' }, { name: 'A Company' }, { name: 'B Company' },
    { name: 'C Company' }, { name: 'D Company' },
];

const cavalryTroops: UnitNode[] = [
    { name: 'HHT' }, { name: 'A Troop' }, { name: 'B Troop' }, { name: 'C Troop' },
];

const artilleryBatteries: UnitNode[] = [
    { name: 'HHB' }, { name: 'A Battery' }, { name: 'B Battery' }, { name: 'C Battery' },
];

const marineRifleCompanies: UnitNode[] = [
    { name: 'H&S Company' }, { name: 'A Company' }, { name: 'B Company' },
    { name: 'C Company' }, { name: 'Weapons Company' },
];

// ---------------------------------------------------------------------------
// Battalion-level templates — division-level elements
// ---------------------------------------------------------------------------

const divartBattalions = (prefix: string): UnitNode[] => [
    { name: `1st FA BN, ${prefix} DIVARTY`, uic: '', children: artilleryBatteries },
    { name: `2nd FA BN, ${prefix} DIVARTY`, uic: '', children: artilleryBatteries },
    { name: `Target Acquisition Battery, ${prefix} DIVARTY` },
];

const cabBattalions = (prefix: string): UnitNode[] => [
    { name: `Attack Reconnaissance BN, ${prefix} CAB`, uic: '', children: standardCompanies },
    { name: `Assault Helicopter BN, ${prefix} CAB`, uic: '', children: standardCompanies },
    { name: `General Support Aviation BN, ${prefix} CAB`, uic: '', children: standardCompanies },
    { name: `Aviation Support BN, ${prefix} CAB`, uic: '', children: standardCompanies },
];

const sustainmentBrigadeBattalions = (prefix: string): UnitNode[] => [
    { name: `1st Support BN, ${prefix} SB`, uic: '', children: standardCompanies },
    { name: `2nd Support BN, ${prefix} SB`, uic: '', children: standardCompanies },
    { name: `Special Troops BN, ${prefix} SB`, uic: '', children: standardCompanies },
];

// ---------------------------------------------------------------------------
// Corps Troops brigade-level templates
// ---------------------------------------------------------------------------

const cavalryRegimentSquadrons = (regt: string): UnitNode[] => [
    { name: `1-${regt}`, uic: '', children: cavalryTroops },
    { name: `2-${regt}`, uic: '', children: cavalryTroops },
    { name: `3-${regt}`, uic: '', children: cavalryTroops },
    { name: `4-${regt}`, uic: '', children: cavalryTroops },
    { name: `Support Squadron, ${regt}`, uic: '', children: standardCompanies },
];

const sfGroupBattalions: UnitNode[] = [
    { name: '1st Battalion', uic: '', children: standardCompanies },
    { name: '2nd Battalion', uic: '', children: standardCompanies },
    { name: '3rd Battalion', uic: '', children: standardCompanies },
    { name: '4th Battalion', uic: '', children: standardCompanies },
    { name: 'Support Battalion', uic: '', children: standardCompanies },
];

const sfabBattalions: UnitNode[] = [
    { name: '1st Battalion', uic: '', children: standardCompanies },
    { name: '2nd Battalion', uic: '', children: standardCompanies },
    { name: '3rd Battalion', uic: '', children: standardCompanies },
    { name: '4th Battalion', uic: '', children: standardCompanies },
    { name: '5th Battalion', uic: '', children: standardCompanies },
    { name: '6th Battalion', uic: '', children: standardCompanies },
];

const transportationBrigadeBattalions: UnitNode[] = [
    { name: '1st Transportation Battalion', uic: '', children: standardCompanies },
    { name: '2nd Transportation Battalion', uic: '', children: standardCompanies },
];

// ---------------------------------------------------------------------------
// Marine battalion templates
// ---------------------------------------------------------------------------

const marineInfantryBattalions: UnitNode[] = [
    { name: '1st Battalion', uic: '', children: marineRifleCompanies },
    { name: '2nd Battalion', uic: '', children: marineRifleCompanies },
    { name: '3rd Battalion', uic: '', children: marineRifleCompanies },
];

const marineArtilleryBattalions: UnitNode[] = [
    { name: '1st Battalion', uic: '', children: artilleryBatteries },
    { name: '2nd Battalion', uic: '', children: artilleryBatteries },
    { name: '3rd Battalion', uic: '', children: artilleryBatteries },
];

// ---------------------------------------------------------------------------
// US Army — Corps, Divisions, BCTs with specific designations
// ---------------------------------------------------------------------------

const armyUnits: UnitNode[] = [
    {
        name: 'I Corps',
        uic: '',
        children: [
            {
                name: '2nd Infantry Division',
                uic: '',
                children: [
                    {
                        name: '1st Stryker Brigade Combat Team, 2ID',
                        uic: '',
                        children: [
                            { name: '2-1 IN', uic: '', children: standardCompanies },
                            { name: '1-23 IN', uic: '', children: standardCompanies },
                            { name: '4-23 IN', uic: '', children: standardCompanies },
                            { name: '8-1 CAV', uic: '', children: cavalryTroops },
                            { name: '2-17 FA', uic: '', children: artilleryBatteries },
                            { name: '23rd BEB', uic: '', children: standardCompanies },
                            { name: '296th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '2nd Stryker Brigade Combat Team, 2ID',
                        uic: '',
                        children: [
                            { name: '1-17 IN', uic: '', children: standardCompanies },
                            { name: '2-23 IN', uic: '', children: standardCompanies },
                            { name: '1-38 IN', uic: '', children: standardCompanies },
                            { name: '1-14 CAV', uic: '', children: cavalryTroops },
                            { name: '2-12 FA', uic: '', children: artilleryBatteries },
                            { name: '14th BEB', uic: '', children: standardCompanies },
                            { name: '2nd BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '3rd Brigade Combat Team, 2ID',
                        uic: '',
                        children: [
                            { name: '1-2 IN', uic: '', children: infantryCompanies },
                            { name: '2-2 IN', uic: '', children: infantryCompanies },
                            { name: '3-2 IN', uic: '', children: infantryCompanies },
                            { name: '1-82 CAV', uic: '', children: cavalryTroops },
                            { name: '1-37 FA', uic: '', children: artilleryBatteries },
                            { name: '2ID BEB', uic: '', children: standardCompanies },
                            { name: '702nd BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: '2ID Division Artillery', uic: '', children: divartBattalions('2ID') },
                    { name: '2ID Combat Aviation Brigade', uic: '', children: cabBattalions('2ID') },
                    { name: '2ID Sustainment Brigade', uic: '', children: sustainmentBrigadeBattalions('2ID') },
                ],
            },
            {
                name: '7th Infantry Division',
                uic: '',
                children: [
                    {
                        name: '1st Brigade Combat Team, 7ID',
                        uic: '',
                        children: [
                            { name: '2-87 IN', uic: '', children: infantryCompanies },
                            { name: '3-21 IN', uic: '', children: infantryCompanies },
                            { name: '5-20 IN', uic: '', children: infantryCompanies },
                            { name: '1-91 CAV', uic: '', children: cavalryTroops },
                            { name: '2-8 FA', uic: '', children: artilleryBatteries },
                            { name: '7ID BEB', uic: '', children: standardCompanies },
                            { name: '7th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '2nd Brigade Combat Team, 7ID',
                        uic: '',
                        children: [
                            { name: '1-21 IN', uic: '', children: infantryCompanies },
                            { name: '2-27 IN', uic: '', children: infantryCompanies },
                            { name: '1-5 IN', uic: '', children: infantryCompanies },
                            { name: '6-9 CAV', uic: '', children: cavalryTroops },
                            { name: '3-7 FA', uic: '', children: artilleryBatteries },
                            { name: '25th BEB', uic: '', children: standardCompanies },
                            { name: '25th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                ],
            },
            {
                name: '25th Infantry Division',
                uic: '',
                children: [
                    {
                        name: '1st Brigade Combat Team, 25ID',
                        uic: '',
                        children: [
                            { name: '2-35 IN', uic: '', children: infantryCompanies },
                            { name: '1-21 IN', uic: '', children: infantryCompanies },
                            { name: '2-11 IN', uic: '', children: infantryCompanies },
                            { name: '3-4 CAV', uic: '', children: cavalryTroops },
                            { name: '3-7 FA', uic: '', children: artilleryBatteries },
                            { name: '25th BEB', uic: '', children: standardCompanies },
                            { name: '25th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '2nd Brigade Combat Team, 25ID',
                        uic: '',
                        children: [
                            { name: '1-27 IN', uic: '', children: infantryCompanies },
                            { name: '2-27 IN', uic: '', children: infantryCompanies },
                            { name: '3-27 IN', uic: '', children: infantryCompanies },
                            { name: '2-14 CAV', uic: '', children: cavalryTroops },
                            { name: '2-11 FA', uic: '', children: artilleryBatteries },
                            { name: '65th BEB', uic: '', children: standardCompanies },
                            { name: '125th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '3rd Brigade Combat Team, 25ID',
                        uic: '',
                        children: [
                            { name: '2-14 IN', uic: '', children: infantryCompanies },
                            { name: '1-14 IN', uic: '', children: infantryCompanies },
                            { name: '3-25 IN', uic: '', children: infantryCompanies },
                            { name: '2-6 CAV', uic: '', children: cavalryTroops },
                            { name: '2-25 FA', uic: '', children: artilleryBatteries },
                            { name: '3rd BEB', uic: '', children: standardCompanies },
                            { name: '325th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: '25ID Division Artillery', uic: '', children: divartBattalions('25ID') },
                    { name: '25ID Combat Aviation Brigade', uic: '', children: cabBattalions('25ID') },
                    { name: '25ID Sustainment Brigade', uic: '', children: sustainmentBrigadeBattalions('25ID') },
                ],
            },
            // Separate brigades grouped at Division level so they cascade to Brigade depth
            {
                name: 'I Corps Troops',
                children: [
                    {
                        name: '17th Field Artillery Brigade',
                        uic: '',
                        children: [
                            { name: '1-94 FA', uic: '', children: artilleryBatteries },
                            { name: '5-3 FA', uic: '', children: artilleryBatteries },
                        ],
                    },
                    {
                        name: '201st Expeditionary MI Brigade',
                        uic: '',
                        children: [
                            { name: '1st MI BN', uic: '', children: standardCompanies },
                            { name: '2nd MI BN', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '555th Engineer Brigade',
                        uic: '',
                        children: [
                            { name: '1st EN BN', uic: '', children: standardCompanies },
                            { name: '2nd EN BN', uic: '', children: standardCompanies },
                            { name: '3rd EN BN', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: '1st Special Forces Group (Airborne)', uic: '', children: sfGroupBattalions },
                    {
                        name: '62nd Medical Brigade',
                        uic: '',
                        children: [
                            { name: '1st Med BN', uic: '', children: standardCompanies },
                            { name: '2nd Med BN', uic: '', children: standardCompanies },
                            { name: 'Med Log BN', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: '1st Multi-Domain Task Force', uic: '' },
                    { name: '593rd Expeditionary Sustainment Command', uic: '' },
                ],
            },
        ],
    },
    {
        name: 'III Corps',
        uic: '',
        children: [
            {
                name: '1st Armored Division',
                uic: '',
                children: [
                    {
                        name: '1st ABCT, 1AD',
                        uic: '',
                        children: [
                            { name: '1-6 IN', uic: '', children: standardCompanies },
                            { name: '1-35 AR', uic: '', children: standardCompanies },
                            { name: '1-37 AR', uic: '', children: standardCompanies },
                            { name: '1-1 CAV', uic: '', children: cavalryTroops },
                            { name: '2-3 FA', uic: '', children: artilleryBatteries },
                            { name: '16th BEB', uic: '', children: standardCompanies },
                            { name: '47th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '2nd ABCT, 1AD',
                        uic: '',
                        children: [
                            { name: '1-35 IN', uic: '', children: standardCompanies },
                            { name: '1-501 AR', uic: '', children: standardCompanies },
                            { name: '3-67 AR', uic: '', children: standardCompanies },
                            { name: '4-1 CAV', uic: '', children: cavalryTroops },
                            { name: '4-27 FA', uic: '', children: artilleryBatteries },
                            { name: '40th BEB', uic: '', children: standardCompanies },
                            { name: '142nd BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '3rd ABCT, 1AD',
                        uic: '',
                        children: [
                            { name: '4-6 IN', uic: '', children: standardCompanies },
                            { name: '1-77 AR', uic: '', children: standardCompanies },
                            { name: '2-77 AR', uic: '', children: standardCompanies },
                            { name: '2-13 CAV', uic: '', children: cavalryTroops },
                            { name: '4-1 FA', uic: '', children: artilleryBatteries },
                            { name: '501st BEB', uic: '', children: standardCompanies },
                            { name: '123rd BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: '1AD Division Artillery', uic: '', children: divartBattalions('1AD') },
                    { name: '1AD Combat Aviation Brigade', uic: '', children: cabBattalions('1AD') },
                    { name: '1AD Sustainment Brigade', uic: '', children: sustainmentBrigadeBattalions('1AD') },
                ],
            },
            {
                name: '1st Cavalry Division',
                uic: '',
                children: [
                    {
                        name: '1st ABCT, 1CD',
                        uic: '',
                        children: [
                            { name: '2-8 CAV', uic: '', children: standardCompanies },
                            { name: '1-12 CAV', uic: '', children: standardCompanies },
                            { name: '2-12 CAV', uic: '', children: standardCompanies },
                            { name: '6-9 CAV', uic: '', children: cavalryTroops },
                            { name: '1-82 FA', uic: '', children: artilleryBatteries },
                            { name: '91st BEB', uic: '', children: standardCompanies },
                            { name: '115th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '2nd ABCT, 1CD',
                        uic: '',
                        children: [
                            { name: '1-5 CAV', uic: '', children: standardCompanies },
                            { name: '1-8 CAV', uic: '', children: standardCompanies },
                            { name: '1-9 CAV', uic: '', children: standardCompanies },
                            { name: '4-9 CAV', uic: '', children: cavalryTroops },
                            { name: '3-82 FA', uic: '', children: artilleryBatteries },
                            { name: '2nd BEB', uic: '', children: standardCompanies },
                            { name: '15th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '3rd ABCT, 1CD',
                        uic: '',
                        children: [
                            { name: '3-8 CAV', uic: '', children: standardCompanies },
                            { name: '1-67 AR', uic: '', children: standardCompanies },
                            { name: '2-7 CAV', uic: '', children: standardCompanies },
                            { name: '3-89 CAV', uic: '', children: cavalryTroops },
                            { name: '2-82 FA', uic: '', children: artilleryBatteries },
                            { name: '3rd BEB', uic: '', children: standardCompanies },
                            { name: '215th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: '1CD Division Artillery', uic: '', children: divartBattalions('1CD') },
                    { name: '1CD Combat Aviation Brigade', uic: '', children: cabBattalions('1CD') },
                    { name: '1CD Sustainment Brigade', uic: '', children: sustainmentBrigadeBattalions('1CD') },
                ],
            },
            {
                name: '4th Infantry Division',
                uic: '',
                children: [
                    {
                        name: '1st Stryker Brigade Combat Team, 4ID',
                        uic: '',
                        children: [
                            { name: '1-38 IN', uic: '', children: standardCompanies },
                            { name: '4-9 IN', uic: '', children: standardCompanies },
                            { name: '1-12 IN', uic: '', children: standardCompanies },
                            { name: '3-61 CAV', uic: '', children: cavalryTroops },
                            { name: '2-12 FA', uic: '', children: artilleryBatteries },
                            { name: '299th BEB', uic: '', children: standardCompanies },
                            { name: '4th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '2nd Brigade Combat Team, 4ID',
                        uic: '',
                        children: [
                            { name: '1-41 IN', uic: '', children: infantryCompanies },
                            { name: '1-26 IN', uic: '', children: infantryCompanies },
                            { name: '1-66 AR', uic: '', children: infantryCompanies },
                            { name: '3-16 CAV', uic: '', children: cavalryTroops },
                            { name: '3-29 FA', uic: '', children: artilleryBatteries },
                            { name: '52nd BEB', uic: '', children: standardCompanies },
                            { name: '204th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '3rd Brigade Combat Team, 4ID',
                        uic: '',
                        children: [
                            { name: '1-8 IN', uic: '', children: infantryCompanies },
                            { name: '2-12 IN', uic: '', children: infantryCompanies },
                            { name: '1-68 AR', uic: '', children: infantryCompanies },
                            { name: '4-10 CAV', uic: '', children: cavalryTroops },
                            { name: '3-4 FA', uic: '', children: artilleryBatteries },
                            { name: '588th BEB', uic: '', children: standardCompanies },
                            { name: '64th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: '4ID Division Artillery', uic: '', children: divartBattalions('4ID') },
                    { name: '4ID Combat Aviation Brigade', uic: '', children: cabBattalions('4ID') },
                    { name: '4ID Sustainment Brigade', uic: '', children: sustainmentBrigadeBattalions('4ID') },
                ],
            },
            // Separate brigades grouped at Division level so they cascade to Brigade depth
            {
                name: 'III Corps Troops',
                children: [
                    { name: '3rd Cavalry Regiment', uic: '', children: cavalryRegimentSquadrons('3 CR') },
                    {
                        name: '75th Field Artillery Brigade',
                        uic: '',
                        children: [
                            { name: '1-14 FA', uic: '', children: artilleryBatteries },
                            { name: '3-13 FA', uic: '', children: artilleryBatteries },
                            { name: '1-17 FA', uic: '', children: artilleryBatteries },
                        ],
                    },
                    {
                        name: '36th Engineer Brigade',
                        uic: '',
                        children: [
                            { name: '1st EN BN', uic: '', children: standardCompanies },
                            { name: '2nd EN BN', uic: '', children: standardCompanies },
                            { name: '3rd EN BN', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '504th MI Brigade',
                        uic: '',
                        children: [
                            { name: '1st MI BN', uic: '', children: standardCompanies },
                            { name: '2nd MI BN', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '1st Medical Brigade',
                        uic: '',
                        children: [
                            { name: '1st Med BN', uic: '', children: standardCompanies },
                            { name: '2nd Med BN', uic: '', children: standardCompanies },
                            { name: 'Med Log BN', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '11th Air Defense Artillery Brigade',
                        uic: '',
                        children: [
                            { name: '1st ADA BN', uic: '', children: artilleryBatteries },
                            { name: '2nd ADA BN', uic: '', children: artilleryBatteries },
                        ],
                    },
                    { name: '89th Sustainment Brigade', uic: '', children: sustainmentBrigadeBattalions('89th') },
                    { name: '1st Security Force Assistance Brigade', uic: '', children: sfabBattalions },
                    { name: '4th Security Force Assistance Brigade', uic: '', children: sfabBattalions },
                    { name: '13th Expeditionary Sustainment Command', uic: '' },
                ],
            },
        ],
    },
    {
        name: 'XVIII Airborne Corps',
        uic: '',
        children: [
            {
                name: '82nd Airborne Division',
                uic: '',
                children: [
                    {
                        name: '1st BCT, 82nd ABN (Devil)',
                        uic: '',
                        children: [
                            { name: '1-504 PIR', uic: '', children: infantryCompanies },
                            { name: '2-504 PIR', uic: '', children: infantryCompanies },
                            { name: '3-504 PIR', uic: '', children: infantryCompanies },
                            { name: '5-73 CAV', uic: '', children: cavalryTroops },
                            { name: '3-319 AFAR', uic: '', children: artilleryBatteries },
                            { name: '37th BEB', uic: '', children: standardCompanies },
                            { name: '1st BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '2nd BCT, 82nd ABN (Falcon)',
                        uic: '',
                        children: [
                            { name: '1-325 AIR', uic: '', children: infantryCompanies },
                            { name: '2-325 AIR', uic: '', children: infantryCompanies },
                            { name: '3-325 AIR', uic: '', children: infantryCompanies },
                            { name: '1-73 CAV', uic: '', children: cavalryTroops },
                            { name: '2-319 AFAR', uic: '', children: artilleryBatteries },
                            { name: '27th BEB', uic: '', children: standardCompanies },
                            { name: '407th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '3rd BCT, 82nd ABN (Panther)',
                        uic: '',
                        children: [
                            { name: '1-508 PIR', uic: '', children: infantryCompanies },
                            { name: '2-508 PIR', uic: '', children: infantryCompanies },
                            { name: '3-508 PIR', uic: '', children: infantryCompanies },
                            { name: '4-73 CAV', uic: '', children: cavalryTroops },
                            { name: '1-319 AFAR', uic: '', children: artilleryBatteries },
                            { name: '307th BEB', uic: '', children: standardCompanies },
                            { name: '82nd BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: '82nd Division Artillery', uic: '', children: divartBattalions('82nd') },
                    { name: '82nd Combat Aviation Brigade', uic: '', children: cabBattalions('82nd') },
                    { name: '82nd Sustainment Brigade', uic: '', children: sustainmentBrigadeBattalions('82nd') },
                ],
            },
            {
                name: '101st Airborne Division',
                uic: '',
                children: [
                    {
                        name: '1st BCT, 101st ABN (Bastogne)',
                        uic: '',
                        children: [
                            { name: '1-327 IN', uic: '', children: infantryCompanies },
                            { name: '2-327 IN', uic: '', children: infantryCompanies },
                            { name: '1-506 IN', uic: '', children: infantryCompanies },
                            { name: '1-32 CAV', uic: '', children: cavalryTroops },
                            { name: '2-320 FAR', uic: '', children: artilleryBatteries },
                            { name: '326th BEB', uic: '', children: standardCompanies },
                            { name: '426th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '2nd BCT, 101st ABN (Strike)',
                        uic: '',
                        children: [
                            { name: '1-502 IN', uic: '', children: infantryCompanies },
                            { name: '2-502 IN', uic: '', children: infantryCompanies },
                            { name: '1-26 IN', uic: '', children: infantryCompanies },
                            { name: '1-75 CAV', uic: '', children: cavalryTroops },
                            { name: '1-320 FAR', uic: '', children: artilleryBatteries },
                            { name: '526th BEB', uic: '', children: standardCompanies },
                            { name: '626th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '3rd BCT, 101st ABN (Rakkasans)',
                        uic: '',
                        children: [
                            { name: '1-187 IN', uic: '', children: infantryCompanies },
                            { name: '2-187 IN', uic: '', children: infantryCompanies },
                            { name: '3-187 IN', uic: '', children: infantryCompanies },
                            { name: '1-33 CAV', uic: '', children: cavalryTroops },
                            { name: '3-320 FAR', uic: '', children: artilleryBatteries },
                            { name: '21st BEB', uic: '', children: standardCompanies },
                            { name: '801st BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: '101st Division Artillery', uic: '', children: divartBattalions('101st') },
                    { name: '101st Combat Aviation Brigade', uic: '', children: cabBattalions('101st') },
                    { name: '101st Sustainment Brigade', uic: '', children: sustainmentBrigadeBattalions('101st') },
                ],
            },
            {
                name: '10th Mountain Division',
                uic: '',
                children: [
                    {
                        name: '1st BCT, 10th MTN',
                        uic: '',
                        children: [
                            { name: '1-87 IN', uic: '', children: infantryCompanies },
                            { name: '2-87 IN', uic: '', children: infantryCompanies },
                            { name: '4-31 IN', uic: '', children: infantryCompanies },
                            { name: '3-71 CAV', uic: '', children: cavalryTroops },
                            { name: '4-25 FA', uic: '', children: artilleryBatteries },
                            { name: '10th BEB', uic: '', children: standardCompanies },
                            { name: '210th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '2nd BCT, 10th MTN',
                        uic: '',
                        children: [
                            { name: '1-22 IN', uic: '', children: infantryCompanies },
                            { name: '2-22 IN', uic: '', children: infantryCompanies },
                            { name: '4-22 IN', uic: '', children: infantryCompanies },
                            { name: '1-89 CAV', uic: '', children: cavalryTroops },
                            { name: '3-6 FA', uic: '', children: artilleryBatteries },
                            { name: '41st BEB', uic: '', children: standardCompanies },
                            { name: '710th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '3rd BCT, 10th MTN',
                        uic: '',
                        children: [
                            { name: '1-32 IN', uic: '', children: infantryCompanies },
                            { name: '2-32 IN', uic: '', children: infantryCompanies },
                            { name: '3-32 IN', uic: '', children: infantryCompanies },
                            { name: '6-6 CAV', uic: '', children: cavalryTroops },
                            { name: '2-15 FA', uic: '', children: artilleryBatteries },
                            { name: '710th BEB', uic: '', children: standardCompanies },
                            { name: '310th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: '10th MTN Division Artillery', uic: '', children: divartBattalions('10th MTN') },
                    { name: '10th MTN Combat Aviation Brigade', uic: '', children: cabBattalions('10th MTN') },
                    { name: '10th MTN Sustainment Brigade', uic: '', children: sustainmentBrigadeBattalions('10th MTN') },
                ],
            },
            {
                name: '3rd Infantry Division',
                uic: '',
                children: [
                    {
                        name: '1st ABCT, 3ID',
                        uic: '',
                        children: [
                            { name: '2-7 IN', uic: '', children: standardCompanies },
                            { name: '3-69 AR', uic: '', children: standardCompanies },
                            { name: '1-64 AR', uic: '', children: standardCompanies },
                            { name: '5-7 CAV', uic: '', children: cavalryTroops },
                            { name: '1-9 FA', uic: '', children: artilleryBatteries },
                            { name: '3rd BEB', uic: '', children: standardCompanies },
                            { name: '203rd BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '2nd ABCT, 3ID',
                        uic: '',
                        children: [
                            { name: '1-30 IN', uic: '', children: standardCompanies },
                            { name: '1-15 IN', uic: '', children: standardCompanies },
                            { name: '2-69 AR', uic: '', children: standardCompanies },
                            { name: '4-3 CAV', uic: '', children: cavalryTroops },
                            { name: '1-41 FA', uic: '', children: artilleryBatteries },
                            { name: '9th BEB', uic: '', children: standardCompanies },
                            { name: '26th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '3rd BCT, 3ID',
                        uic: '',
                        children: [
                            { name: '1-28 IN', uic: '', children: infantryCompanies },
                            { name: '2-28 IN', uic: '', children: infantryCompanies },
                            { name: '5-1 IN', uic: '', children: infantryCompanies },
                            { name: '3-71 CAV', uic: '', children: cavalryTroops },
                            { name: '1-76 FA', uic: '', children: artilleryBatteries },
                            { name: '10th BEB', uic: '', children: standardCompanies },
                            { name: '3rd BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: '3ID Division Artillery', uic: '', children: divartBattalions('3ID') },
                    { name: '3ID Combat Aviation Brigade', uic: '', children: cabBattalions('3ID') },
                    { name: '3ID Sustainment Brigade', uic: '', children: sustainmentBrigadeBattalions('3ID') },
                ],
            },
            // Separate brigades grouped at Division level so they cascade to Brigade depth
            {
                name: 'XVIII Airborne Corps Troops',
                children: [
                    {
                        name: '18th Field Artillery Brigade',
                        uic: '',
                        children: [
                            { name: '3-27 AFAR', uic: '', children: artilleryBatteries },
                            { name: '1-321 FA', uic: '', children: artilleryBatteries },
                            { name: '3-321 FA', uic: '', children: artilleryBatteries },
                        ],
                    },
                    {
                        name: '16th Military Police Brigade',
                        uic: '',
                        children: [
                            { name: '1st MP BN', uic: '', children: standardCompanies },
                            { name: '2nd MP BN', uic: '', children: standardCompanies },
                            { name: '3rd MP BN', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '525th MI Brigade',
                        uic: '',
                        children: [
                            { name: '1st MI BN', uic: '', children: standardCompanies },
                            { name: '2nd MI BN', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '44th Medical Brigade',
                        uic: '',
                        children: [
                            { name: '1st Med BN', uic: '', children: standardCompanies },
                            { name: '2nd Med BN', uic: '', children: standardCompanies },
                            { name: 'Med Log BN', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: '20th CBRNE Command', uic: '' },
                    {
                        name: '18th Engineer Brigade',
                        uic: '',
                        children: [
                            { name: '1st EN BN', uic: '', children: standardCompanies },
                            { name: '2nd EN BN', uic: '', children: standardCompanies },
                            { name: '3rd EN BN', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: '2nd Security Force Assistance Brigade', uic: '', children: sfabBattalions },
                    { name: '3rd Expeditionary Sustainment Command', uic: '' },
                ],
            },
        ],
    },
    {
        name: 'V Corps',
        uic: '',
        children: [
            {
                name: '1st Infantry Division',
                uic: '',
                children: [
                    {
                        name: '1st ABCT, 1ID',
                        uic: '',
                        children: [
                            { name: '2-34 AR', uic: '', children: standardCompanies },
                            { name: '1-16 IN', uic: '', children: standardCompanies },
                            { name: '1-63 AR', uic: '', children: standardCompanies },
                            { name: '5-4 CAV', uic: '', children: cavalryTroops },
                            { name: '1-5 FA', uic: '', children: artilleryBatteries },
                            { name: '1st BEB', uic: '', children: standardCompanies },
                            { name: '101st BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '2nd ABCT, 1ID',
                        uic: '',
                        children: [
                            { name: '1-18 IN', uic: '', children: standardCompanies },
                            { name: '1-34 AR', uic: '', children: standardCompanies },
                            { name: '2-70 AR', uic: '', children: standardCompanies },
                            { name: '1-4 CAV', uic: '', children: cavalryTroops },
                            { name: '1-7 FA', uic: '', children: artilleryBatteries },
                            { name: '2nd BEB', uic: '', children: standardCompanies },
                            { name: '299th BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    {
                        name: '3rd BCT, 1ID',
                        uic: '',
                        children: [
                            { name: '2-2 IN', uic: '', children: infantryCompanies },
                            { name: '1-26 IN', uic: '', children: infantryCompanies },
                            { name: '6-37 IN', uic: '', children: infantryCompanies },
                            { name: '3-1 CAV', uic: '', children: cavalryTroops },
                            { name: '2-32 FA', uic: '', children: artilleryBatteries },
                            { name: '3rd BEB', uic: '', children: standardCompanies },
                            { name: '601st BSB', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: '1ID Division Artillery', uic: '', children: divartBattalions('1ID') },
                    { name: '1ID Combat Aviation Brigade', uic: '', children: cabBattalions('1ID') },
                    { name: '1ID Sustainment Brigade', uic: '', children: sustainmentBrigadeBattalions('1ID') },
                ],
            },
            // Separate brigades grouped at Division level so they cascade to Brigade depth
            {
                name: 'V Corps Troops',
                children: [
                    { name: '2nd Cavalry Regiment', uic: '', children: cavalryRegimentSquadrons('2 CR') },
                    { name: '12th Combat Aviation Brigade', uic: '', children: cabBattalions('12th') },
                    {
                        name: '41st Field Artillery Brigade',
                        uic: '',
                        children: [
                            { name: '1-77 FA', uic: '', children: artilleryBatteries },
                            { name: '1-6 FA', uic: '', children: artilleryBatteries },
                        ],
                    },
                    { name: '7th Army Training Command', uic: '' },
                    { name: '21st Theater Sustainment Command', uic: '' },
                ],
            },
        ],
    },
    // Special Operations
    {
        name: 'USASOC',
        uic: '',
        children: [
            {
                name: '1st Special Forces Command (Airborne)',
                uic: '',
                children: [
                    { name: '1st Special Forces Group (Airborne)', uic: '', children: sfGroupBattalions },
                    { name: '3rd Special Forces Group (Airborne)', uic: '', children: sfGroupBattalions },
                    { name: '5th Special Forces Group (Airborne)', uic: '', children: sfGroupBattalions },
                    { name: '7th Special Forces Group (Airborne)', uic: '', children: sfGroupBattalions },
                    { name: '10th Special Forces Group (Airborne)', uic: '', children: sfGroupBattalions },
                ],
            },
            {
                name: '75th Ranger Regiment',
                uic: '',
                children: [
                    { name: '1st Ranger Battalion', uic: '', children: standardCompanies },
                    { name: '2nd Ranger Battalion', uic: '', children: standardCompanies },
                    { name: '3rd Ranger Battalion', uic: '', children: standardCompanies },
                    { name: 'Regimental Special Troops Battalion', uic: '', children: standardCompanies },
                ],
            },
            // Standalone units grouped so they cascade to Brigade depth
            {
                name: 'USASOC Direct Reporting Units',
                children: [
                    {
                        name: '160th Special Operations Aviation Regiment',
                        uic: '',
                        children: [
                            { name: '1st BN, 160th SOAR', uic: '', children: standardCompanies },
                            { name: '2nd BN, 160th SOAR', uic: '', children: standardCompanies },
                            { name: '3rd BN, 160th SOAR', uic: '', children: standardCompanies },
                            { name: '4th BN, 160th SOAR', uic: '', children: standardCompanies },
                        ],
                    },
                    { name: 'JFK Special Warfare Center and School', uic: '' },
                    { name: '528th Sustainment Brigade (Special Operations) (Airborne)', uic: '', children: sustainmentBrigadeBattalions('528th') },
                ],
            },
        ],
    },
    // Army Medical Command
    {
        name: 'MEDCOM',
        uic: '',
        children: [
            { name: 'Regional Health Command - Atlantic', uic: '' },
            { name: 'Regional Health Command - Pacific', uic: '' },
            { name: 'Regional Health Command - Central', uic: '' },
            { name: 'US Army Medical Research and Development Command', uic: '' },
            { name: 'US Army Medical Logistics Command', uic: '' },
            { name: 'Army Medical Center of Excellence', uic: '' },
        ],
    },
    // Intelligence and Security Command
    {
        name: 'INSCOM',
        uic: '',
        children: [
            {
                name: '66th MI Brigade',
                uic: '',
                children: [
                    { name: '1st MI BN', uic: '', children: standardCompanies },
                    { name: '2nd MI BN', uic: '', children: standardCompanies },
                ],
            },
            {
                name: '116th MI Brigade',
                uic: '',
                children: [
                    { name: '1st MI BN', uic: '', children: standardCompanies },
                    { name: '2nd MI BN', uic: '', children: standardCompanies },
                ],
            },
            {
                name: '470th MI Brigade',
                uic: '',
                children: [
                    { name: '1st MI BN', uic: '', children: standardCompanies },
                    { name: '2nd MI BN', uic: '', children: standardCompanies },
                ],
            },
            {
                name: '500th MI Brigade',
                uic: '',
                children: [
                    { name: '1st MI BN', uic: '', children: standardCompanies },
                    { name: '2nd MI BN', uic: '', children: standardCompanies },
                ],
            },
            { name: '902nd MI Group', uic: '' },
            { name: '1st Information Operations Command', uic: '' },
        ],
    },
    // Training and Doctrine Command
    {
        name: 'TRADOC',
        uic: '',
        children: [
            { name: 'Combined Arms Center', uic: '' },
            { name: 'Center for Initial Military Training', uic: '' },
            { name: 'Maneuver Center of Excellence', uic: '' },
            { name: 'Fires Center of Excellence', uic: '' },
            { name: 'Sustainment Center of Excellence', uic: '' },
            { name: 'Mission Command Center of Excellence', uic: '' },
            { name: 'Intelligence Center of Excellence', uic: '' },
            { name: 'Cyber Center of Excellence', uic: '' },
        ],
    },
    // Army Futures Command
    {
        name: 'Army Futures Command',
        uic: '',
        children: [
            { name: 'Combat Capabilities Development Command', uic: '' },
            { name: 'Futures and Concepts Center', uic: '' },
        ],
    },
    // Space and Missile Defense Command
    {
        name: 'USASMDC',
        uic: '',
        children: [
            { name: '100th Missile Defense Brigade', uic: '' },
            { name: '1st Space Brigade', uic: '' },
        ],
    },
    // Surface Deployment and Distribution Command
    {
        name: 'SDDC',
        uic: '',
        children: [
            { name: '596th Transportation Brigade', uic: '', children: transportationBrigadeBattalions },
            { name: '597th Transportation Brigade', uic: '', children: transportationBrigadeBattalions },
            { name: '598th Transportation Brigade', uic: '', children: transportationBrigadeBattalions },
            { name: '599th Transportation Brigade', uic: '', children: transportationBrigadeBattalions },
        ],
    },
    // National Guard (Bureau — major divisional units)
    {
        name: 'ARNG (National Guard)',
        uic: '',
        children: [
            { name: '28th Infantry Division', uic: '' },
            { name: '29th Infantry Division', uic: '' },
            { name: '34th Infantry Division', uic: '' },
            { name: '35th Infantry Division', uic: '' },
            { name: '36th Infantry Division', uic: '' },
            { name: '38th Infantry Division', uic: '' },
            { name: '40th Infantry Division', uic: '' },
            { name: '42nd Infantry Division', uic: '' },
        ],
    },
];

// ---------------------------------------------------------------------------
// US Navy
// ---------------------------------------------------------------------------

const navyUnits: UnitNode[] = [
    {
        name: 'U.S. Pacific Fleet',
        uic: '',
        children: [
            { name: 'Third Fleet', uic: '' },
            { name: 'Seventh Fleet', uic: '' },
            { name: 'Naval Surface Force Pacific', uic: '' },
            { name: 'Naval Air Force Pacific', uic: '' },
            { name: 'Submarine Force Pacific', uic: '' },
        ],
    },
    {
        name: 'U.S. Fleet Forces Command',
        uic: '',
        children: [
            { name: 'Second Fleet', uic: '' },
            { name: 'Naval Surface Force Atlantic', uic: '' },
            { name: 'Naval Air Force Atlantic', uic: '' },
            { name: 'Submarine Force Atlantic', uic: '' },
        ],
    },
    {
        name: 'Naval Forces Europe-Africa / Sixth Fleet',
        uic: '',
        children: [
            { name: 'Sixth Fleet', uic: '' },
        ],
    },
    {
        name: 'Naval Special Warfare Command',
        uic: '',
        children: [
            { name: 'Naval Special Warfare Group 1', uic: '' },
            { name: 'Naval Special Warfare Group 2', uic: '' },
            { name: 'Naval Special Warfare Group 10', uic: '' },
            { name: 'Naval Special Warfare Group 11', uic: '' },
        ],
    },
    {
        name: 'Naval Information Forces',
        uic: '',
        children: [
            { name: 'Navy Cyber Defense Operations Command', uic: '' },
            { name: 'Naval Information Warfare Center Atlantic', uic: '' },
            { name: 'Naval Information Warfare Center Pacific', uic: '' },
        ],
    },
    {
        name: 'Naval Education and Training Command',
        uic: '',
        children: [
            { name: 'Center for Naval Aviation Technical Training', uic: '' },
            { name: 'Center for Surface Combat Systems', uic: '' },
            { name: 'Center for Seabees and Facilities Engineering', uic: '' },
        ],
    },
    { name: 'Military Sealift Command', uic: '', children: [] },
    { name: 'Naval Facilities Engineering Systems Command', uic: '', children: [] },
    {
        name: 'Bureau of Medicine and Surgery',
        uic: '',
        children: [
            { name: 'Naval Medical Forces Atlantic', uic: '' },
            { name: 'Naval Medical Forces Pacific', uic: '' },
        ],
    },
];

// ---------------------------------------------------------------------------
// US Marine Corps
// ---------------------------------------------------------------------------

const marineUnits: UnitNode[] = [
    {
        name: 'I Marine Expeditionary Force',
        uic: '',
        children: [
            {
                name: '1st Marine Division',
                uic: '',
                children: [
                    { name: '1st Marine Regiment', uic: '', children: marineInfantryBattalions },
                    { name: '5th Marine Regiment', uic: '', children: marineInfantryBattalions },
                    { name: '7th Marine Regiment', uic: '', children: marineInfantryBattalions },
                    { name: '11th Marine Regiment', uic: '', children: marineArtilleryBattalions },
                ],
            },
            {
                name: '3rd Marine Aircraft Wing',
                uic: '',
                children: [
                    { name: 'MAG-11', uic: '' },
                    { name: 'MAG-13', uic: '' },
                    { name: 'MAG-16', uic: '' },
                    { name: 'MAG-39', uic: '' },
                    { name: 'MWSS-373', uic: '' },
                ],
            },
            { name: '1st Marine Logistics Group', uic: '' },
            { name: '1st Marine Expeditionary Force Information Group', uic: '' },
        ],
    },
    {
        name: 'II Marine Expeditionary Force',
        uic: '',
        children: [
            {
                name: '2nd Marine Division',
                uic: '',
                children: [
                    { name: '2nd Marine Regiment', uic: '', children: marineInfantryBattalions },
                    { name: '6th Marine Regiment', uic: '', children: marineInfantryBattalions },
                    { name: '8th Marine Regiment', uic: '', children: marineInfantryBattalions },
                    { name: '10th Marine Regiment', uic: '', children: marineArtilleryBattalions },
                ],
            },
            {
                name: '2nd Marine Aircraft Wing',
                uic: '',
                children: [
                    { name: 'MAG-14', uic: '' },
                    { name: 'MAG-26', uic: '' },
                    { name: 'MAG-29', uic: '' },
                    { name: 'MWSS-274', uic: '' },
                ],
            },
            { name: '2nd Marine Logistics Group', uic: '' },
            { name: '2nd Marine Expeditionary Force Information Group', uic: '' },
        ],
    },
    {
        name: 'III Marine Expeditionary Force',
        uic: '',
        children: [
            {
                name: '3rd Marine Division',
                uic: '',
                children: [
                    { name: '3rd Marine Regiment', uic: '', children: marineInfantryBattalions },
                    { name: '4th Marine Regiment', uic: '', children: marineInfantryBattalions },
                    { name: '12th Marine Regiment', uic: '', children: marineArtilleryBattalions },
                ],
            },
            {
                name: '1st Marine Aircraft Wing',
                uic: '',
                children: [
                    { name: 'MAG-12', uic: '' },
                    { name: 'MAG-24', uic: '' },
                    { name: 'MAG-36', uic: '' },
                    { name: 'MWSS-171', uic: '' },
                ],
            },
            { name: '3rd Marine Logistics Group', uic: '' },
            { name: '3rd Marine Expeditionary Force Information Group', uic: '' },
        ],
    },
    // Force-level commands
    {
        name: 'Marine Forces Special Operations Command',
        uic: '',
        children: [
            { name: '1st Marine Raider Battalion', uic: '', children: standardCompanies },
            { name: '2nd Marine Raider Battalion', uic: '', children: standardCompanies },
            { name: '3rd Marine Raider Battalion', uic: '', children: standardCompanies },
            { name: 'Marine Raider Support Group', uic: '' },
        ],
    },
    {
        name: 'Marine Forces Reserve',
        uic: '',
        children: [
            { name: '4th Marine Division', uic: '' },
            { name: '4th Marine Aircraft Wing', uic: '' },
            { name: '4th Marine Logistics Group', uic: '' },
        ],
    },
];

// ---------------------------------------------------------------------------
// US Air Force
// ---------------------------------------------------------------------------

const airForceUnits: UnitNode[] = [
    {
        name: 'Air Combat Command',
        uic: '',
        children: [
            { name: '1st Fighter Wing', uic: '' },
            { name: '9th Reconnaissance Wing', uic: '' },
            { name: '55th Wing', uic: '' },
            { name: '325th Fighter Wing', uic: '' },
            { name: '366th Fighter Wing', uic: '' },
            { name: '388th Fighter Wing', uic: '' },
            { name: '432nd Wing', uic: '' },
            { name: '480th Intelligence, Surveillance and Reconnaissance Wing', uic: '' },
        ],
    },
    {
        name: 'Air Mobility Command',
        uic: '',
        children: [
            { name: '18th Air Force', uic: '' },
            { name: '60th Air Mobility Wing', uic: '' },
            { name: '62nd Airlift Wing', uic: '' },
            { name: '305th Air Mobility Wing', uic: '' },
            { name: '437th Airlift Wing', uic: '' },
            { name: '375th Air Mobility Wing', uic: '' },
        ],
    },
    {
        name: 'Air Force Global Strike Command',
        uic: '',
        children: [
            { name: '8th Air Force', uic: '' },
            { name: '20th Air Force', uic: '' },
        ],
    },
    {
        name: 'Pacific Air Forces',
        uic: '',
        children: [
            { name: '5th Air Force', uic: '' },
            { name: '7th Air Force', uic: '' },
            { name: '11th Air Force', uic: '' },
            { name: '36th Wing', uic: '' },
            { name: '354th Fighter Wing', uic: '' },
        ],
    },
    {
        name: 'United States Air Forces in Europe - Air Forces Africa',
        uic: '',
        children: [
            { name: '3rd Air Force', uic: '' },
            { name: '16th Air Force', uic: '' },
            { name: '31st Fighter Wing', uic: '' },
            { name: '48th Fighter Wing', uic: '' },
            { name: '52nd Fighter Wing', uic: '' },
        ],
    },
    {
        name: 'Air Force Special Operations Command',
        uic: '',
        children: [
            { name: '1st Special Operations Wing', uic: '' },
            { name: '24th Special Operations Wing', uic: '' },
            { name: '27th Special Operations Wing', uic: '' },
            { name: '352nd Special Operations Wing', uic: '' },
            { name: '353rd Special Operations Wing', uic: '' },
        ],
    },
    {
        name: 'Air Education and Training Command',
        uic: '',
        children: [
            { name: '2nd Air Force', uic: '' },
            { name: '19th Air Force', uic: '' },
            { name: 'Air University', uic: '' },
        ],
    },
    {
        name: 'Air Force Materiel Command',
        uic: '',
        children: [
            { name: 'Air Force Research Laboratory', uic: '' },
            { name: 'Air Force Test Center', uic: '' },
            { name: 'Air Force Life Cycle Management Center', uic: '' },
            { name: 'Air Force Sustainment Center', uic: '' },
            { name: 'Air Force Nuclear Weapons Center', uic: '' },
            { name: 'Air Force Installation and Mission Support Center', uic: '' },
        ],
    },
    {
        name: 'Air Force Reserve Command',
        uic: '',
        children: [
            { name: '4th Air Force', uic: '' },
            { name: '10th Air Force', uic: '' },
            { name: '22nd Air Force', uic: '' },
        ],
    },
    {
        name: 'United States Space Force',
        uic: '',
        children: [
            { name: 'Space Operations Command', uic: '' },
            { name: 'Space Systems Command', uic: '' },
            { name: 'Space Training and Readiness Command', uic: '' },
        ],
    },
];

// ---------------------------------------------------------------------------
// Export: tree indexed by component
// ---------------------------------------------------------------------------

export const unitStructure: Record<Component, UnitNode[]> = {
    USA: armyUnits,
    USN: navyUnits,
    USMC: marineUnits,
    USAF: airForceUnits,
};
