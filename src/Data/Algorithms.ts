import type { AlgorithmType, dispositionType } from "../Types/AlgorithmTypes";
import { medList } from "./MedData";

// disposition types. text updated if required.
export const Disposition: dispositionType[] = [
    {
        type: "CAT I",
        text: "Provider Now"
    },
    {
        type: "CAT II",
        text: "AEM Now"
    },
    {
        type: "CAT III",
        text: "Treatment Protocol and RTD"
    },
    {
        type: "CAT IV",
        text: "Referral"
    },
    {
        type: "OTHER",
        text: ""
    }
]

export const Algorithm: AlgorithmType[] = [
    {
        id: "A-1",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Shortness of Breath" },
                    { text: "Stridor" },
                    { text: "Deviated Uvula" },
                    { text: "Drooling/ Trouble Swallowing" },
                    { text: "Stiff Neck" }
                ],
                answerOptions: []
            },
            {
                text: "Are red flags present?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            Disposition[0]
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['peritonsillar abscess', 'upper airway obstruction'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as "Provider Now." One-sided severe sore throat with fever, trouble swallowing as shown by drooling, uvula displacement, hoarseness (hot potato voice), trismus (lock jaw), and enlarged, tender tonsils are signs of a deep neck space infection like a peritonsillar abscess. Shortness of breath and stridor are signs of upper airway obstruction due to severe pharyngeal inflammation.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Symptoms > 10 days" },
                    { text: "Immunosuppression" },
                    { text: "Inhaled steroid" },
                    { text: "Fever > 48 hours" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Symptoms greater than 10 days, immunosuppression, inhaled steroid medications are related to diseases that are unlikely to go away without treatment. Hoarseness longer than 2 weeks requires a full laryngeal exam.'
                            }
                        ],
                        disposition: [
                            Disposition[1]
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "How many of the following apply?",
                type: "count",
                questionOptions: [
                    { text: "Fever > 100.4 F (refer to supervising medical provider" },
                    { text: "No Cough" },
                    { text: "Tonsillar Exudate" },
                    { text: "Swollen anterior cervical nodes" }
                ],
                answerOptions: [
                    {
                        text: "3+ Centor",
                        decisionMaking: [
                        ],
                        disposition: [],
                        next: [4, 5],
                        selectAll: true
                    },
                    {
                        text: "0-2 CENTOR",
                        disposition: [
                            Disposition[2]
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['viral infection'],
                                text: 'Other protocols. Sore throat and hoarseness that are associated with a virus should be treated with minor-care. The other symptoms should be treated according to their associated protocols. See COVID-19 L-13.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Salt water gargles and drink warm fluids for inflammation. Return if not improving in 3 days or immediately if worsening symptoms or Red Flags',
                                    medFind: [
                                        { ...medList[8] },
                                        { ...medList[0] },
                                        { ...medList[23] }
                                    ]
                                }
                            },
                            {
                                type: 'mcp',
                                ddx: ['sore throat'],
                                text: 'A sore throat is often due to a viral infection. Minor-care consist of pain control, measures to decrease inflammation, getting plenty of rest and drinking plenty of fluids (water). Return for signs of the infection getting worse or progressing.',
                            },
                            {
                                type: 'mcp',
                                ddx: ['hoarseness'],
                                text: 'Hoarseness is often due to a virus or irritant. Minor-care consists of resting the vocal cords and avoidance of irritants (cigarette smoking, yelling, heartburn, post-nasal drip). This is a good opportunity to discuss the negative effects of tobacco use and encourage the Soldier to quit using tobacco, if applicable.',
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Collect the following labs",
                type: "action",
                questionOptions: [
                    { text: 'Rapid Strep + Culture Test (barracks, positive close contact, immunosuppressed contact, h/o ARF)' }
                ],
                answerOptions: []
            },
            {
                text: "What is the test result?",
                type: "choice",
                questionOptions: [
                ],
                answerOptions: [
                    {
                        text: "Positive",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['Streptococcal Infection'],
                                text: '4 questions that look at the chance of having a Group A Streptococcal (GAS) infection. If 3 of the questions are positive, there is 32% chance of having GAS and a rapid antigen test (RADT) should be performed. The RADT is effective for ruling out GAS in adults but some Soldiers with GAS are missed. Culture test is performed when the RADT is negative and Soldiers or their contacts are at higher risk for complications from a GAS infection. Culture generally takes 24-48 hours for the results to return.',
                                ancillaryFind: [
                                    {
                                        type: 'lab',
                                        modifier: 'rapid strep'
                                    }
                                ]
                            }
                        ],
                        disposition: [
                            Disposition[1]
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "Negative",
                        disposition: [
                            Disposition[2]
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['viral infection'],
                                text: 'Other protocols. Sore throat and hoarseness that are associated with a virus should be treated with minor-care. The other symptoms should be treated according to their associated protocols. See COVID-19 L-13.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Salt water gargles and drink warm fluids for inflammation. Return if not improving in 3 days or immediately if worsening symptoms or Red Flags',
                                    medFind: [
                                        { ...medList[8] },
                                        { ...medList[0] },
                                        { ...medList[23] }
                                    ]
                                }
                            },
                            {
                                type: 'mcp',
                                ddx: ['sore throat'],
                                text: 'A sore throat is often due to a viral infection. Minor-care consist of pain control, measures to decrease inflammation, getting plenty of rest and drinking plenty of fluids (water). Return for signs of the infection getting worse or progressing.',
                            },
                            {
                                type: 'mcp',
                                ddx: ['hoarseness'],
                                text: 'Hoarseness is often due to a virus or irritant. Minor-care consists of resting the vocal cords and avoidance of irritants (cigarette smoking, yelling, heartburn, post-nasal drip). This is a good opportunity to discuss the negative effects of tobacco use and encourage the Soldier to quit using tobacco, if applicable.',
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "A-2",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Stiff Neck AND Fever" },
                    { text: "Posterior ear pain and/or mastoid erythema" }
                ],
                answerOptions: []
            },
            {
                text: "Are red flags present?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['meningitis', 'mastoiditis'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” A stiff neck and fever are signs of meningitis, and all Soldiers with signs of meningitis should be seen by a privileged provider as soon as possible. Mastoid symptoms can be a sign of mastoiditis.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Severe Ear pain" },
                    { text: "Ear drainage" },
                    { text: "Fever" },
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        next: [3, 4],
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        next: 5,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Perform an otoscope exam (both ears). Look for the following:",
                type: "action",
                questionOptions: [
                    { text: "TM: redness, opacification, bulging, immobility, rupture" },
                    { text: "Ear Canal (EC) redness, swollen, tenderness" }
                ],
                answerOptions: []
            },
            {
                text: "Are there TM symptoms, or concern for Mod-Severe Otitis Externa?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['otitis media', 'moderate to severe otitis externa'],
                                text: 'Signs of infection. All Soldiers with otitis media or moderate to severe otitis externa should be evaluated by a privileged provider to be considered for antibiotics.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        next: 5,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Vertigo" },
                    { text: "Going on for > 7 days" },
                    { text: "Decreased hearing" },
                    { text: "Foreign body in ear" },
                    { text: "Visual trauma to ear" }],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'DP2. Vertigo requires an internal ear evaluation. Longer timeline and decreased hearing can be signs of a complication from an ear infection or alternate cause requiring a qualified provider evaluation.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        next: [6, 7],
                        selectAll: false
                    }
                ]
            },
            {
                text: "Check for TMJ inflammation",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Is there TMJ Inflammation?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Mild otitis externa, temporal-mandibular joint (TMJ) dysfunction, and ear pain with normal exam should be treated with minor-care.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['Mild Otitis Externa'],
                                text: 'Soak wick of a cotton ball wick with OTC ear drops. Place in the ear for 24 hours while using the drops. Remove the cotton wick and continue drops for 1 week (3 days after the symptoms have resolved). Keep the ear canal dry. Use OTC ibuprofen as needed for pain. Return to clinic if not resolved in 1 week or worsening symptoms to include pain or fever.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Soak wick of a cotton ball with ear drops. pleace in the ear for 24 hours while using the drops. Remove the cotton wick and continue drops for 1 week (3 days after the symptoms have resolved). Keep the ear canal dry. Return if not improving in 3 days, worsening symptoms, dizziness, loss of hearing, stiff neck',
                                    specLim: [
                                        'Avoidance of situations requiring utilization of ear plugs',
                                        'No swimming'
                                    ],
                                    ancillaryFind: [
                                        {
                                            type: 'med',
                                            modifier: 'hydrocortisone ear drops'
                                        }
                                    ],
                                    medFind: [medList[0], medList[23]]
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['TMJ'],
                                text: 'another common cause of pain around the ear. Evaluation includes seeing if the pain increases with opening and closing the jaw while placing the finger on the anterior inside of the ear to feel the joint. Ensure pain is not related to the heart. Use OTC ibuprofen for inflammation and pain. Refer to dental if history of teeth grinding. Instruct on avoidance of triggers (excessive chewing, chewing gum). Home therapy is jaw isometric exercises: jaw is open 1 inch and jaw is pushed 1) down against a loosely fisted hand and 2) forward against a hand for 5 seconds each, each set is repeated 5 times per session with 3 sessions per day. Return if not improving within three days.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Refer to dental if history of teeth grinding, ibuprofen as needed for pain, instruct on avoidance of triggers and home jaw exercises. Return if not improving in 3 days, worsening symptoms, dizziness, loss of hearing, stiff neck.',
                                    medFind: [medList[23]],
                                    ancillaryFind: [
                                        {
                                            type: 'refer',
                                            modifier: 'Dental if history of teeth grinding'
                                        }
                                    ]
                                }
                            },
                            {
                                type: 'lim',
                                ddx: ['Eustachian Tube Dysfunction'],
                                text: 'No scuba diving'
                            }
                        ],
                        next: null,
                        selectAll: false
                    },
                    {
                        text: "No",
                        disposition: [{ ...Disposition[4], modifier: 'Screen Cold Sx. Sore Throat if Present' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        next: null,
                        selectAll: false
                    },
                ]
            }
        ]
    },
    {
        id: "A-3",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Abnormal Vital Signs" },
                    { text: "Shortness of Breath" },
                    { text: "Stiff Neck" },
                    { text: "Altered Mental Status" },
                    { text: "Coughing up blood clots or frank blood" }
                ],
                answerOptions: []
            },
            {
                text: "Are red flags present?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            Disposition[0] // CAT I: Provider Now
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['respiratory compromise', 'meningitis', 'sepsis', 'bleeding within lungs'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Shortness of breath and abnormal pulse oxygenation suggest respiratory compromise. The soldier should be immediately started on oxygen pending further evaluation. Fever with a stiff neck suggests meningitis. Quick Sequential (sepsis-related) Organ Failure Assessment (qSOFA) is comprised of a respiratory rate greater than 21, systolic blood pressure less than 101, and Glasgow coma scale less than 15. Coughing up blood clots or quarter sized amounts of blood can be a sign of bleeding within the lungs.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['sinusitis'],
                                text: 'Soldier with an ongoing productive cough may be contagious and needs to be evaluated for quarters. Viral symptoms that are improving and then get worse or onset of severe pain over the cheekbones/back upper teeth (sinuses) can be a sign of a sinus problem requiring prescription medications.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Productive cough" },
                    { text: "Symptoms > 7 days" },
                    { text: "Severe sinus or dental pain" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[1], modifier: 'place mask' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['pneumonia', 'sinusitis'],
                                text: 'Soldier with an ongoing productive cough may be contagious and needs to be evaluated for quarters. Viral symptoms that are improving and then get worse or onset of severe pain over the cheekbones/back upper teeth (sinuses) can be a sign of a sinus problem requiring prescription medications.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Symptoms > 7 days" },
                    { text: "Rebound symptoms" },
                    { text: "Purulent discharge" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            { ...Disposition[1], modifier: 'place mask' }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['retained foreign body', 'infectious process'],
                                text: 'Purulent material is thick, yellow/greenish, foul smelling nasal discharge. Purulent discharge can be a sign of an infection or a retained foreign body in the nose.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['infectious process'],
                                text: 'If symptoms have been going on for over seven days, evaluate for a bacterial infection.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [
                            Disposition[2]
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['upper respiratory infection'],
                                text: 'Most upper respiratory tract infection symptoms which include sore throat and ear pain are caused by a virus or allergies and do not require antibiotics. Minor-care is focused on improving the symptoms that the Soldier is having while the issue resolves on its own.',
                                assocMcp: {
                                    text: 'Counsel the Soldier to drink plenty of fluids, get plenty of rest, and to cover their mouth when coughing and wash their hands to prevent spread. Stop or limit smoking. Ibuprofen for pain, Acetaminophen for elevated temperature, decongestant for nasal congestion, guaifenesin for mucous, or antihistamine for allergies. Return if it does not improve in 7 days, worsening symptoms, develop sinus pain, lightheaded, neck pain, or fever.',
                                    medFind: [
                                        { ...medList[23] },
                                        { ...medList[0] },
                                        { ...medList[32] },
                                        { ...medList[20] }
                                    ],
                                    specLim: ['Consider quarters/ contagious precautions while febrile'
                                    ]
                                },
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "A-4",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Altered Mental Status" },
                    { text: "Focal Neurological Symptom or Sign" },
                    { text: "Dizziness" }
                ],
                answerOptions: []
            },
            {
                text: "Are red flags present?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            Disposition[0]
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Altered mental status is a sign of a more serious underlying problem. Ear trauma can also result in a concussion that needs to be evaluated further. Focal neurological symptom/sign require further evaluation.'
                            }
                        ],
                        next: null,
                        selectAll: true,
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false,
                    }
                ]
            },
            // Q1 - First choice question
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Ringing > 24 hours" },
                    { text: "Ringing without MOI" },
                    { text: "Dizziness" },
                    { text: "Visual Trauma" },
                    { text: "Decreased hearing" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            Disposition[0]
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['inner ear pathology'],
                                text: 'Ringing greater than 24 hours or related to an event requires further evaluation. Vertigo or “room-spinning dizziness” can be a symptom of inner ear problems and is often associated with nausea. Distinguish vertigo from light-headedness which is screened separately.'
                            }
                        ],
                        next: null,
                        selectAll: true,
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 3,
                        selectAll: false,
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Loud noise exposure or trauma within 24 hours" },
                    { text: "Ear drainage" },
                    { text: "Ear pain" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [],
                        next: [4, 5],
                        selectAll: true,
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 6, // Go to Q5
                        selectAll: false,
                    }
                ]
            },
            {
                text: "Perform an otoscope exam (both ears).",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Are any of the following present?",
                type: "choice",
                questionOptions: [{ text: 'TM opacification' }, { text: 'immobility' }, { text: 'rupture' }, { text: 'Ear canal foreign body' }, { text: 'wax buildup' }],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[0], modifier: 'Ear irrigation if wax and TM intact' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['TM rupture', 'inner ear pathology', 'foreign body', 'excessive wax'],
                                text: 'Trauma and blast injuries can result in Tympanic Membrane or inner ear problems. Foreign body or excessive wax within the ear canal can result in reversible hearing loss. If excessive wax is present, discuss removal with supervisor.',
                                ancillaryFind: [
                                    { type: 'protocol', modifier: 'Ear irrigation' }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true,
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 5,
                        selectAll: false,
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    {
                        text: "Ear pain",
                    },
                    {
                        text: "Cold symptoms",
                    }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[3],
                                text: "Rescreen as Ear Pain, Cold Symptoms"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the ringing noise is an associated symptom of a cold or flu, it should be screened by the protocol that addresses that primary complaint.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['loud noise exposure'],
                                text: 'Ringing in the ears, if without loss of balance, is not uncommon especially following recent exposure to loud noises from situations such as weapons firing or riding in mechanized vehicles or aircraft. Generally, the ringing in the ears associated with such noises subsides within 24 hours, but may persist in persons who have long histories of exposure.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['tinnitus'],
                                text: 'Further examination is indicated in the absence of exposure to excessive noise or for symptoms lasting longer than 24 hours.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['hearing loss', 'otosclerosis'],
                                text: 'Ringing in the ears, if without loss of balance, can be associated with certain medications such as aspirin, nonsteroidal anti-inflammatory agents, some diuretics, etc. It is also important to check for hearing on the follow-up visit.'
                            }
                        ],
                        next: null,
                        selectAll: true,
                    },
                    {
                        text: "No",
                        disposition: [
                            Disposition[2]
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['loud noise exposure'],
                                text: 'Tinnitus due to recent noise exposure should show improvement over the next 24 hours. Stress the importance of utilizing correct fitting hearing protection. Instruct the Soldier to return for medical assistance if ringing does not improve or if dizziness, ear pain, or hearing loss develops. Temporary sensation of hearing loss can be due to colds or ear infections. Soldiers with upper respiratory infection symptoms should be screened according to those protocols.',
                                assocMcp: {
                                    text: 'Ringing sound after exposure to excessive noise exposure should resolve within 24 hours. Return to clinic if the ringing does not resolve after 24 hours. Return if associated with dizziness (spinning sensation) or worsening symptoms',
                                    medFind: [],
                                    specLim: ['Avoid loud noise exposure x 48 hours'
                                    ]
                                },
                            }
                        ],
                        next: null,
                        selectAll: false,
                    }
                ]
            }
        ]
    },
    {
        id: "A-5",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Airway Compromise" },
                    { text: "Orthostatic Hypotension" },
                    { text: "Bleeding from Gums" },
                    { text: "Inability to Move Eye" }
                ],
                answerOptions: []
            },
            {
                text: "Stop the bleeding using the following methods:",
                type: "action",
                questionOptions: [
                    { text: "Tilt head forwards" },
                    { text: "Blow nose gently" },
                    { text: "Give 2 sprays of Oxymetazoline (Afrin)" },
                    { text: "Pinch nose for five minutes with index finger and thumb" }
                ],
                answerOptions: []
            },
            {
                text: "Is the bleeding Controlled?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "No",
                        disposition: [
                            Disposition[0]
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['volume depletion', 'mucosal trauma', 'posterior nosebleed'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as Provider Now. Orthostatic hypotension is a sign of volume depletion and can represent a significant amount of blood loss. Nosebleeds normally result from the rupture of small blood vessels inside the nose related to mucosal trauma (nose picking) or irritation (dry climate, blowing nose). 90% occur in the front of septum in the nose and can be controlled by applying external pressure. If the bleeding does not stop, then the nosebleed likely is coming from the back of the nose and needs to be controlled by a privileged provider.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "Yes",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Cut or deformity" },
                    { text: "Patient is on anticoagulants" },
                    { text: "Patient is using intra-nasal medication" },
                    { text: "Patient has high blood pressure ( > 140/80)" },
                    { text: "Purulent discharge present" },
                    { text: "Recurrent bleed w/o cold" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            Disposition[1]
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['nasal trauma'],
                                text: 'Soldiers who have had trauma to the nose with an associated nosebleed require further screening.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['nasal trauma'],
                                text: 'A misaligned broken nose can affect the upper airway and increase the risk of future sinus infections. Other injuries can be associated with the force that caused the trauma and nosebleed.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['coagulopathy'],
                                text: 'Nosebleed while on anticoagulants can make it more difficult to stop a nosebleed and be a sign that the anticoagulation level is too high.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['retained foreign body', 'infection'],
                                text: 'Purulent discharge can be related to a retained foreign body or a concurrent infection that requires additional treatment.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['coagulopathy'],
                                text: 'Recurrent nosebleeds not associated with a cold can be a sign of a bleeding disorder.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 4,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Current cold or cold symptoms" },
                    { text: "Runny nose" },
                    { text: "Allergy symptoms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[3],
                                text: "Rescreen as Cold symptoms"
                            },
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['viral infection', 'nose picking', 'allergies'],
                                text: 'Cold symptoms often result in nosebleeds from recurrent blowing of the nose, rubbing the nose with a tissue after blowing it, picking the nose from congestion, and prominent blood vessels from allergies or inflammation.'
                            },
                            {
                                type: 'dmp',
                                text: 'Soldiers with symptoms of runny nose, congestion, or allergies should be screened with the cold symptoms protocol.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [
                            Disposition[2]
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['nosebleed'],
                                text: 'MCP Nosebleed. Once the bleeding is controlled, tell the Soldier to avoid vigorous blowing of the nose. If the room air is dry a humidifier or vaporizer often helps. Instruct the Soldier to return for medical assistance if the bleeding recurs and is not able to be controlled with tilting the head forward and applying external pressure with the thumb and index finger for 5 minutes or if the amount of blood lost at one time is enough to soak a wash cloth (ask the Soldier to bring in his wash cloth). Saline nasal spray can be used to prevent future nosebleeds if the air is dry after the initial nosebleed has resolved. Decongestant (Oxymetazoline) can be used to constrict the blood vessels.',
                                assocMcp: {
                                    text: 'Do not blow the nose vigorously or wipe the middle of the nose, as it can cause a nosebleed. Medications: nasal saline for prevention if the air is dry, oxymetazoline if recurrent with nasal sx. Humidifier can also be used if the air is dry. Return if unable to get a recurrent nosebleed to stop, notice bleeding from other sites, feeling lightheaded or tired, losing a significant amount of blood, or recurrent without common cold sx.',
                                    medFind: [
                                        { ...medList[32] },
                                    ],
                                    specLim: []
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "B-1",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Fever" },
                    { text: "Saddle Anesthesia" },
                    { text: "Urinary Retention/Incontinence" },
                    { text: "Fecal Incontinence" },
                    { text: "Motor Deficits" },
                    { text: "Trauma with Vertebral Tenderness or Neuropathy" },
                    { text: "Dysuria/Frequency" },
                    { text: "Chest/Abdominal Pain" }
                ],
                answerOptions: []
            },
            {
                text: "Are red flags present or is there significant MOI?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.'
                            },
                            {
                                type: 'dmp',
                                text: 'A focused history and physical exam is essential to localizing a Soldier’s complaint of back pain and identifying its source. The HPI should include an OPQRST evaluation of the complaint and the ROS should specifically address red flag symptoms as well as questions related but not limited to infection, trauma, cardiopulmonary, gastrointestinal, and genitourinary, or gynecological complaints.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Are there radicular symptoms below the knee",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",

                        disposition: [
                            {
                                ...Disposition[1],
                                text: "AEM Now, PT if available"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['acute back pain', 'nerve impingement'],
                                text: 'Back pain associated with pain, numbness, or tingling running down into the legs may represent central or peripheral nerve impingement and requires further evaluation. Refer to a physical therapist if direct referral is available locally.',
                                ancillaryFind: [
                                    {
                                        type: 'refer',
                                        modifier: 'physical therapy if available'
                                    }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['strain', 'sprain', 'obesity'],
                                text: 'LBP is extremely common in Soldiers. The best treatment is conservative measures including a home exercise program for mobilization and strengthening, ice and heat as needed for inflammation, and pain control with analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Follow established local protocols for home exercise that focus on stretching the lower back and hamstrings multiple times per day, strengthening the core muscles daily, and pain control as needed. Often obesity is a factor in low back pain and Soldiers should be encouraged to lose weight. Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, worsening of other symptoms, symptoms last longer than one week. If direct access to physical therapy (physical therapy sick call) is available, consider direct referral to physical therapy in accordance with local policy.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Provide home exercise program, activity modification as appropriate. Intermittent ice or heat IAW local protocol for inflammation. Medication: analgesic balm for mild pain, Ibuprofen (1st line) and Ketorolac (2nd line) for moderate pain as needed. Refer to PT if direct access is available. Follow-up: Immediate follow-up for a DP1 or DP2 symptoms. Routine follow-up is recommended for any symptoms that do not improve or worsen',
                                    medFind: [
                                        { ...medList[28] },
                                        { ...medList[23] },
                                        { ...medList[24] }
                                    ],
                                    ancillaryFind: [
                                        {
                                            type: 'refer',
                                            modifier: 'physical therapy if direct access available'
                                        }
                                    ],
                                    specLim: ['No repetitive bending or lifting but may lift/ carry up to 40lbs.', 'Perform stretching, core strengthening home regiment during PT.', 'No ruck marching, running, or jumping but may walk, bike, or swim for cardio'
                                    ]
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "B-2",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Bony step off/midline tenderness to palpation" },
                    { text: "Inability to flex neck" },
                    { text: "Fever" },
                    { text: "Recent HEENT or dental infection" }
                ],
                answerOptions: []
            },
            {
                text: "Red flags or significant MOI?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['vertebral fracture'],
                                text: 'Bony step off and midline tenderness can be signs of a vertebral fracture.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['meningitis', 'vertebral fracture'],
                                text: 'Inability to flex the neck can be a sign of meningitis or fracture. '
                            },
                            {
                                type: 'dmp',
                                ddx: ['infection'],
                                text: 'Recent head, eyes, ears, nose, and throat (HEENT) or dental infection can have progressed to a more serious infection.'
                            },
                            {
                                type: 'dmp',
                                text: 'Action 1. In the setting of trauma, immobilize the head and neck and support ABCs as required, then transfer care to a privileged provider'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Are any of the following present?",
                type: "choice",
                questionOptions: [
                    { text: "Radiating pain" },
                    { text: "Numbness" },
                    { text: "Tingling" },
                    { text: "Weakness" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[1],
                                text: "AEM Now, PT if available"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['nerve impingement'],
                                text: 'Neck pain associated with pain, numbness, or tingling running down into the shoulder or arms may represent central or peripheral nerve impingement and requires further evaluation. Refer to physical therapy if direct referral is available locally.',
                                ancillaryFind: [
                                    {
                                        type: 'refer',
                                        modifier: 'phyisical therapy if available'
                                    }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['sprain', 'strain'],
                                text: 'MCP. Neck pain is extremely common in Soldiers. The best treatment is conservative measures including a home exercise program for mobilization and strengthening, ice and heat as needed for inflammation, and pain as needed. A temporary profile may be required. Instruct the Soldier to work the neck through its range of motion at least twice each day to preserve mobility. This should ideally be done after a 20-minute application of ice. The range of motion exercise should not be vigorous enough to cause pain. Follow established local protocols for home exercise. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, worsening of other symptoms, symptoms last longer than one week. If direct access to physical therapy (physical therapy sick call) is available,',
                                assocMcp: {
                                    text: 'Provide home exercise program. Activity modification as appropriate. Intermittent ice or heat as needed for inflammation. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed. Refer to PT if direct access is available. Follow-up: Immediate follow-up for a DP1 or DP2 symptoms.  Routine follow-up is recommended for any symptoms that do not improve or worsen',
                                    medFind: [
                                        { ...medList[28] },
                                        { ...medList[23] },
                                        { ...medList[24] }
                                    ],
                                    ancillaryFind: [
                                        {
                                            type: 'refer',
                                            modifier: 'physical therapy if available'
                                        }
                                    ],
                                    specLim: ['No rucking or jumping.', 'Consider limiting Kevlar use.', 'Restrict driving if limited ROM.', 'Perform stretching, core strengthening home regiment during PT'
                                    ]
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "B-3",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Distal Pulses Abnormal" },
                    { text: "Distal Sensation Abnormal" },
                    { text: "Deformity" },
                    { text: "Cardiac Symptoms" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "The shoulder is red/warm" },
                    { text: "Abdominal symptoms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[0], modifier: 'Immobilize the injured extremity before transport or referral' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['dislocation', 'fracture', 'myocardial infarction'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Abnormal distal pulse or sensation in the setting of trauma is a medical emergency require immediate evaluation. Deformity can be a dislocated shoulder or fracture. Myocardial infarction can be associated with shoulder pain.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['myocardial infarction', 'infection', 'extrinsic cause'],
                                text: 'The red flags indicate a medical emergency. Immobilize the affected extremity prior to transport if associated with trauma. Immediately refer shoulder pain associated with cardiac symptoms (sweating, shortness of breath, chest or jaw pain/ pressure). A red, warm, swollen joint or pain with fever can be a sign of an infected joint requiring immediate surgical evaluation. Abdominal symptoms suggest an extrinsic cause requiring evaluation.'
                            },
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Symptoms > 3 weeks" },
                    { text: "Neurologic symptoms" },
                    { text: "Limited motion" },
                    { text: "Laceration" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[1],
                                text: "AEM Now, PT if available",
                                modifier: 'Sling the injured extremity for comfort before transport or referral'
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['nerve impingement', 'fracture'],
                                text: 'Neurologic symptoms (numbness, weakness) suggest nerve impingement. Limited motion suggests a more significant injury that should be placed in a sling and require further evaluation. Laceration may require closure.',
                                ancillaryFind: [
                                    {
                                        type: 'refer',
                                        modifier: 'physical therapy if available'
                                    }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['sprain', 'strain'],
                                text: 'The best treatment is conservative measures including a home exercise program for mobilization and strengthening and analgesics as needed. A temporary profile may be required. Instruct the Soldier to work the injured shoulder through its range of motion (but not vigorous enough to cause pain) at least twice each day to preserve mobility after a 20-minute application of ice. Follow established local protocols for home exercise. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, worsening of other symptoms, symptoms last longer than one week.", "Refer to PT if direct access to physical therapy (physical therapy sick call) is available, in accordance with local policy.',
                                assocMcp: {
                                    text: 'Provide home exercise program. Activity modification as appropriate", "Intermittent ice or heat for inflammation", "Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed", "Refer to PT if direct access is available", "Follow-up: Immediate follow-up for a DP1 or DP2 symptoms. Routine follow-up is recommended for any symptoms that do not improve or worsen.',
                                    medFind: [
                                        { ...medList[28] },
                                        { ...medList[23] },
                                        { ...medList[24] }
                                    ],
                                    ancillaryFind: [
                                        {
                                            type: 'refer',
                                            modifier: 'physical therapy if available'
                                        }
                                    ],
                                    specLim: ['May lift, push, pull up to 5 lbs.', 'No overhead lifting or repetitive activities.', 'Perform stretching, core strengthening home regiment during PT'
                                    ]
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "B-4",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Distal Pulses Abnormal" },
                    { text: "Distal Sensation Abnormal" },
                    { text: "Deformity" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "The elbow is red/warm" },
                    { text: "Diffuse Pain" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Abnormal distal pulse or sensation in the setting of trauma is a medical emergency requiring immediate evaluation.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['fracture', 'dislocation', 'infection', 'systemic cause'],
                                text: 'Immobilize the affected extremity prior to transport if associated with trauma. A red, warm, swollen joint or pain with fever can be a sign of an infected joint requiring immediate surgical evaluation. Diffuse pain that involves multiple joints or muscles may represent a systemic cause and requires further evaluation.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Limited ROM" },
                    { text: "Neck, Shoulder Sx" },
                    { text: "Sx > 2 weeks" },
                    { text: "Ulnar Hand Sx" },
                    { text: "Swelling" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[1],
                                text: "AEM Now, PT if available"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['joint pathology', 'nerve impingement'],
                                text: 'Limited ROM and swelling may represent an issue within the joint requiring further evaluation. Neck and shoulder issues may refer pain to the elbow. Ulnar nerve pain may be referred to the ulnar side of the forearm, hand, pinky, and ring finger area.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['sprain', 'strain'],
                                text: 'The best treatment is conservative measures including a home exercise program for mobilization and strengthening and analgesics as needed. A temporary profile may be required. Instruct the Soldier to work the injured elbow through its range of motion at least twice each day to preserve mobility. This should ideally be done after a 20-minute application of ice. The range of motion exercise should not be vigorous enough to cause pain. Follow established local protocols for home exercise. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, worsening of other symptoms, symptoms last longer than one week. If direct access to physical therapy (physical therapy sick call) is available, consider direct referral to physical therapy in accordance with local policy.',
                                assocMcp: {
                                    text: 'Provide home exercise program. Activity modification as appropriate. Intermittent ice or heat for inflammation. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed. Refer to PT if direct access is available. Follow-up: Immediate follow-up for a DP1 or DP2 symptoms. Routine follow-up is recommended for any symptoms that do not improve or worsen.',
                                    medFind: [
                                        { ...medList[28] },
                                        { ...medList[23] },
                                        { ...medList[24] }
                                    ],
                                    ancillaryFind: [
                                        {
                                            type: 'refer',
                                            modifier: 'phyisical therapy if available'
                                        }
                                    ],
                                    specLim: ['May lift, push, pull up to 5 lbs.', 'No repetitive bending of elbow or turning/ bending of wrist.', 'Perform stretching, core strengthening home regiment during PT'
                                    ],
                                }
                            }
                        ],
                        disposition: [Disposition[2]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    // Search Tag B-5
    {
        id: "B-5",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Distal Pulses Abnormal" },
                    { text: "Distal Sensation Abnormal" },
                    { text: "Deformity" },
                    { text: "Open Fracture" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags Present" },
                    { text: "Red/warm" },
                    { text: "Trauma/ FOOSH" },
                    { text: "No MOI" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "[ACT1 PLACEHOLDER]"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Abnormal distal pulse or sensation in the setting of trauma is a medical emergency requiring immediate evaluation.'
                            },
                            {
                                type: 'dmp',
                                text: 'DP 1. In the setting of trauma, the red flags are an indicator of a medical emergency. Immobilize the affected extremity prior to transport. A red, warm, swollen joint or pain with fever can be a sign of an infected joint requiring immediate surgical evaluation. Trauma and Pain without recent trauma or overuse injury may represent a systemic problem to include rheumatoid arthritis or Lyme disease.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Index, thumb sx" },
                    { text: "Clicking/popping" },
                    { text: "Mobile mass over tendon" },
                    { text: "Laceration" },
                    { text: "Inability to do job" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[1],
                                text: "AEM Now, PT if available"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    // Search Tag B-6
    {
        id: "B-6",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Abnormal Capillary Refill" },
                    { text: "Abnormal Distal Sensation" },
                    { text: "Palmar Infection" },
                    { text: "Deformity" },
                    { text: "Significant Burn" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Crush Injury" },
                    { text: "History of Punching" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Abnormal distal pulse or sensation in the setting of trauma is a medical emergency requiring immediate evaluation. Significant burns of the hands are considered high risk and should be evaluated for referral to a burn center.'
                            },
                            {
                                type: 'dmp',
                                text: 'The red flags are an indication of a medical emergency. In the setting of trauma, immobilize the affected extremity prior to transport. Crush injuries and history of punching something are common causes of fractures requiring further evaluation.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Finger catching/locking" },
                    { text: "Laceration" },
                    { text: "Ulcers" },
                    { text: "Abscess" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[1],
                                text: "AEM Now, PT if appropriate"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['trigger finger', 'herptic whitlow', 'laceration', 'abscess'],
                                text: 'Finger catching or locking during flexion may represent trigger finger. Ulcers can represent herpetic whitlow (herpes infection). Lacerations and abscesses require further evaluation.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['Paronychia'],
                                text: 'Instruct the Soldier to soak the finger in warm water for 10-15 minutes three times per day and apply topical antibiotic cream after each soak. Ibuprofen (1st line) or acetaminophen (2nd line) can be provided as needed for pain. Ketorolac (3rd line) can be used once on presentation if needed for moderate pain. Return if worsening, increasing redness, abscess formation, not improving in two days. ',
                                assocMcp: {
                                    text: '10-15min warm soaks 3 times per day and topical antibiotic cream after each soak. Ibuprofen (1st line) or acetaminophen (2nd line) as needed for pain. Ketorolac (3rd line) can be used once on presentation for moderate pain. Return if worsening, spreading redness, abscess formation, not improving in 2 days.',
                                    medFind: [
                                        { ...medList[23] },
                                        { ...medList[0] },
                                        { ...medList[24] }
                                    ],
                                    specLim: ['Keep area clean and dry']
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['Sprain'],
                                text: 'Anatomically splint the finger to the adjacent finger with tape. Instruct the Soldier on activity modification as appropriate. Instruct the Soldier on the intermittent use of ice for swelling, ibuprofen (1st line) or acetaminophen (2nd line) as needed for pain. Ketorolac (3rd line) can be used once on presentation if needed for moderate pain. Return to clinic if the symptoms are getting worse, pain becomes severe enough to prevent performance of normal duties/activities, or improvement is not seen within one week.',
                                assocMcp: {
                                    text: 'Activity modification as appropriate, Intermittent ice for swelling, ibuprofen (1st line) or acetaminophen (2nd line) as needed for pain. Splint to adjacent finger. Return if worsening or not improving.',
                                    medFind: [
                                        { ...medList[23] },
                                        { ...medList[0] },
                                        { ...medList[24] }
                                    ],
                                    specLim: ['May Lift, push, pull up to 5 lbs.', 'May tape or brace comfort.', 'No contact sports']
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "B-7",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Abnormal PMS" },
                    { text: "Deformity" },
                    { text: "High Energy Trauma" },
                    { text: "Suspect Stress Fracture (increased with weight bearing or during exercise, endurance training, change in exercise routine)" },
                    { text: "Severe Pain" }
                ],
                answerOptions: []
            },
            {
                text: "Red Flags present?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[0],
                                text: "Provider Now, BSI Policy",
                                modifier: "mmobilize the hip or femur as indicated if associated with trauma. Stress injury: crutches (toe touch)"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Abnormal distal pulse or sensation in the setting of trauma is a medical emergency requiring immediate evaluation.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['hip fracture', 'stress injury'],
                                text: 'Significant force of trauma to include car accident can cause a hip fracture. Immobilize the affected extremity prior to transport. Pain with weight bearing or starts after a certain point during exercise can be a sign of a stress injury. Increase in exercise, long endurance training, or recent modification to training can be risk factors of a stress injury. Place the Soldier on crutches with toe touch weight bearing until a bone stress injury is ruled out.',
                                ancillaryFind: [
                                    {
                                        type: 'protocol',
                                        modifier: 'crutches, toe touch weight bearing'
                                    }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Paresthesia" },
                    { text: "Not worse with direct pressure, hip flexion" },
                    { text: "Limited ROM" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[1],
                                text: "AEM Now, PT if available"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['nerve entrapment', 'abdominal pathology', 'testicular pathology', 'inguinal hernia'],
                                text: 'Lateral hip pain with paresthesia is the classic presentation for lateral femoral cutaneous nerve entrapment. Abdominal pathology, testicular pathology, inguinal hernia may present with anterior hip pain that is not worse with palpation, flexion, or weight bearing.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['strain', 'sprain'],
                                text: 'The best treatment is conservative measures including a home exercise program for mobilization and strengthening and analgesics as needed. Instruct the Soldier to work the injured wrist through its range of motion (but not vigorous enough to cause pain) at least twice each day to preserve mobility after a 20-minute application of ice. Follow established local protocols for home exercise. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, pain with weight bearing or exercise develops, worsening of symptoms, symptoms last longer than 3 days. If direct access to physical therapy (physical therapy sick call) is available, consider direct referral to physical therapy in accordance with local policy.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Provide home exercise program. Activity modification as appropriate. Intermittent ice or heat for inflammation. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed. Refer to PT if direct access is available',
                                    medFind: [],
                                    ancillaryFind: [
                                        {
                                            type: 'refer',
                                            modifier: 'physical therapy sick call if available'
                                        }
                                    ],
                                    specLim: ['No running, jumping but may walk up to ¼ mile at own pace/ distance and stand up to 20min', 'May Lift, carry, push, pull up to 25 lbs', 'No repetitive lifting from floor', 'Perform stretching, core strengthening home regiment during PT']
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "B-8",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Abnormal PMS" },
                    { text: "Deformity" },
                    { text: "High Energy Trauma" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags present" },
                    { text: "Red/ warm" },
                    { text: "Immediate swelling after trauma" },
                    { text: "No MOI" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "Immobilize the injured extremity before transport"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”'
                            },
                            {
                                type: 'dmp',
                                ddx: ['fracture', 'infection', 'hemarthrosis', 'inflammatory condition'],
                                text: 'In the setting of trauma, deformity with loss of peripheral pulses or sensation is an indication of a medical emergency. High energy trauma to include car accident, skiing injury, or fall from a height should be assumed to have a serious injury until ruled out. Immobilize the affected extremity prior to transport. Red, warm joint could represent inflammation or infection. Swelling immediately after a traumatic event can be a sign of bleeding into the knee joint. Closer the pain and swelling are related to the traumatic event, the more likely there is a significant injury. Lack of an identifiable cause or relation to activity suggests an inflammatory cause that requires further evaluation.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Swelling" },
                    { text: "Decreased ROM" },
                    { text: "Previous knee injury" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[1],
                                text: "AEM Now, PT if available"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[2]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "B-9",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Abnormal Distal Pulse" },
                    { text: "Abnormal Sensation" },
                    { text: "Deformity" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags present" },
                    { text: "Calf squeeze" },
                    { text: "Unrelated to overuse or injury" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "[ACT1 PLACEHOLDER]"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Ottowa test" },
                    { text: "Squeeze Test" },
                    { text: "Medial injury" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[1],
                                text: "AEM Now, PT if available",
                                modifier: "[ACT2 PLACEHOLDER]"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[2]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "B-10",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Abnormal Distal Pulse" },
                    { text: "Abnormal Sensation" },
                    { text: "Deformity" },
                    { text: "Suspect Stress Fracture (increased with weight bearing or during exercise, endurance training, change in exercise routine)" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags present" },
                    { text: "Constant pain" },
                    { text: "Unrelated to overuse or injury" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                text: "Provider Now, BSI Policy",
                                modifier: "[ACT1 PLACEHOLDER]"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Numbness" },
                    { text: "Red and warm" },
                    { text: "Abscess" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[1],
                                text: "AEM Now, PT if appropriate"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[2]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "B-11",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Abnormal Distal Pulse" },
                    { text: "Abnormal Sensation" },
                    { text: "Deformity" },
                    { text: "Cola Colored Urine" },
                    { text: "Inability to Urinate" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags present" },
                    { text: "Severe pain" },
                    { text: "Suspect stress fracture" },
                    { text: "Swelling, erythema" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                text: "Provider Now",
                                modifier: "BSI Policy"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Abnormal joint function, limited range of motion or loss of strength" },
                    { text: "Laceration" },
                    { text: "Pain > 1 week" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[1],
                                text: "AEM Now, PT if available",
                                modifier: "[ACT2 PLACEHOLDER]"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[2]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "C-1",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Vomiting Blood or Coffee Grinds, Melena" },
                    { text: "Neurologic Symptoms" },
                    { text: "Chest Pain" },
                    { text: "Abdominal Pain followed by Nausea" },
                    { text: "Abdominal Distension" }
                ],
                answerOptions: []
            },
            {
                text: "Red Flags?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['intestinal bleed', 'increased intracranial pressure', 'myocardial infarction'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Vomiting blood/coffee grinds and melena can be signs of an intestinal bleed. Neurologic symptoms can be a sign of increased intracranial pressure. Myocardial infarction can present with nausea.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Chemotherapy" },
                    { text: "BMI < 18" },
                    { text: "Diabetes" },
                    { text: "Recent head trauma w/in 72 hrs" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['diabetes', 'bulimia', 'gastroparesis'],
                                text: 'These represent the possibility of more significant underlying medical conditions. A common side effect of chemotherapy treatment is nausea and vomiting that is sometimes difficult to control. BMI less than 18 can be a sign of an eating disorder like bulimia or another significant medical condition. Uncontrolled diabetes and gastroparesis due to diabetes can also present with nausea and vomiting.'
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Greater than 72 hrs" },
                    { text: "Signs of fluid depletion, orthostatic hypotension" },
                    { text: "Unable to maintain oral intake" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[1],
                                modifier: " \u2640 Pregnancy Screen/Test"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['fluid depletion', 'pregnancy'],
                                text: 'These are symptoms that are related to volume depletion. Fluid depletion is a risk of significant nausea and vomiting. If a Soldier is not able to maintain fluid intake due to his or her nausea and vomiting, then short term hospitalization has to be considered until the nausea and vomiting can be controlled. Nausea and vomiting, especially in the mornings, is a common symptom in pregnancy. If a Soldier has a positive pregnancy test or symptoms of nausea during pregnancy, she will require a longer-term plan than the minor-care protocol can accommodate.',
                                ancillaryFind: [
                                    {
                                        type: 'lab',
                                        modifier: 'pregnancy test'
                                    }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: [4, 5],
                        selectAll: false
                    }
                ]
            },
            {
                text: "\u2640 Pregnancy Screen/Test",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Headache (migraine)" },
                    { text: "Heartburn" },
                    { text: "Dizziness" },
                    { text: "Pregnancy" },
                    { text: "Other symptoms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[3],
                                text: "Screen heartburn, headache, dizziness, pregnancy, or other symptoms if present"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['vertigo', 'migraines', 'heartburn', 'pregnancy'],
                                text: 'There are many other symptoms that can be associated with nausea and vomiting to include dizziness (vertigo), headaches (migraines) and heartburn. Reflux and regurgitation (return of gastric contents to hypopharynx with little effort) can be seen with heartburn and do not require treatment unless symptomatic.',
                                ancillaryFind: [
                                    {
                                        type: 'lab',
                                        modifier: 'pregnancy test '
                                    }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['nausea', 'vomiting', 'viral illness'],
                                text: 'Handwashing is important to prevent spread of disease. Due to contagion risk, activity modification is important for food handlers and multiple cases or when DFAC food is suspected must be reported to the supervising NCO due to the potential of an outbreak. Diet control is very important in treating nausea and vomiting. Ice chips should be used initially. Once vomiting is controlled, advance to clear liquids (broth, fruit juice, sports drink and caffeine free soda). Start with small sips and slowly advance. Once the Soldier has been able to tolerate liquids for 24 hours, advance to a BRAT (bread, rice, apple sauce, toast) diet of simple carbohydrates. The Soldier with severe or persistent vomiting that is unable to tolerate liquids will require IV fluids. Advise the Soldier to return for medical assistance if the symptoms last more than two days, if blood appears in his vomit or in his stools, or if he becomes dizzy and/or faints upon standing. Vomiting that is severe enough to prevent the Soldier from keeping clear liquids down for 24 hours, severe abdominal pain, or worsening symptoms are also causes for a prompt return visit.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Hand washing protocol. Special food handler precautions. Notify supervising NCO if DFAC food is suspected or multiple cases identified. Initiate a clear liquid diet with broth, sports drinks, clear non-caffeine soft drinks, fruit juice. ice chips to maintain calories and hydration. When vomiting controlled, start BRAT diet of simple carbohydrates. Return to clinic if not improved in 48 hours or any of the red flags or other symptoms develop.',
                                    specLim: ['No food handling, if work in a DFAC, until symptoms have resolved x 48 hours']
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "C-2",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Vomiting Blood or Coffee Grinds, Melena" },
                    { text: "Severe abdominal pain" },
                    { text: "Significant weight loss" }
                ],
                answerOptions: []
            },
            {
                text: "Red Flags?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['intestinal bleed'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Nausea/ vomiting blood or coffee grinds and melena can be signs of an intestinal bleeding. Melena is a tar like stool with a very pungent odor resulting from the digestion of blood.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Recent hospital stay" },
                    { text: "Recent antibiotics" },
                    { text: "Bloody diarrhea" },
                    { text: "H/O inflammatory bowel disease" },
                    { text: "Severe abdominal pain" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['clostridium difficile infection', 'invasive infection', 'inflammatory bowel disease', 'ischemic colitis'],
                                text: 'Recent hospitalization and antibiotic use are risk factors for a clostridium difficile infection. Clostridium difficile infections often present with a strong odor and bloody diarrhea and can result in life threatening infections. Bloody diarrhea that is not just on the toilet paper from repetitive irritation or from a gastrointestinal bleed is likely the result of an invasive infection. Visibly bloody diarrhea could also be from inflammatory bowel disease or ischemic colitis. Severe abdominal pain as Soldier appearing in discomfort/distress including moaning, crying, bending over, trouble moving or pain rating of 8+/10.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "> 6 unformed stools in 24 hours" },
                    { text: "Hypovolemia" },
                    { text: "Dizziness" },
                    { text: "3+ days" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Severe or persistent symptoms may require the use of empiric antibiotics.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['diarrhea'],
                                text: 'Start a clear liquid diet (broth, fruit juice, sports drink, caffeine free soda) for 24 hours. Advance to a BRAT (banana, rice, apple sauce, toast) diet of simple carbohydrates next. Watch for signs of dehydration. Pepto-Bismol (1st line) may be given to the Soldier for the symptomatic control of diarrhea. Discuss with the supervising provider if antibiotics are required when considering to use Imodium (2nd line). Frequent hand washing should be used after using the bathroom and before eating. Food workers must not handle food till after symptoms have resolved. Advise the Soldier to return for medical assistance if the symptoms last more than one week, if symptoms worsen, or if he becomes dizzy and/or faints upon standing.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Medication: bismuth subsalicylate (1st line) as needed, discuss with provider before giving Imodium (2nd line)", "Initiate a clear liquid diet with broth, sports drinks, cler non-caffeine soft drinks, fruit juice, ice chips to maintain calories and hydration. When diarrhea controlled, start BRAT diet of simple carbohydrates.',
                                    medFind: [medList[11], medList[26]],
                                    specLim: ['No food handling, if work in a DFAC, until symptoms have resolved x 48 hours", "Must have access to a restroom within 2 minutes']
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "C-3",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Abnormal Vitals" },
                    { text: "Abdominal rigidity/rebound (bump chair)" },
                    { text: "Severe pain" },
                    { text: "Fever with jaundice and RUQ pain" },
                    { text: "Confirmed Pregnancy" },
                    { text: "Alcoholism" },
                    { text: "Immunocompromised" },
                    { text: "RLQ Pain" }
                ],
                answerOptions: []
            },
            {
                text: "\u2640 Pregnancy Screen/ Test",
                type: "action",
                questionOptions: [],
                answerOptions: [],
            },
            {
                text: "Red Flags?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Unstable vitals represent a significant health risk. Abdominal rigidity and rebound or significant Soldier discomfort with bumping the Soldier’s stretcher/chair are signs of peritonitis and can represent a surgical abdomen. Level of pain may represent the significance of the underlying disease.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Melena" },
                    { text: "Coffee grind emesis" },
                    { text: "Periumbilical pain" },
                    { text: "Abdominal trauma w/in 72 hours" },
                    { text: "40+ years old" },
                    { text: "Chest pain and nausea" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Suspected melena and coffee grind emesis should be tested and referred to a privileged provider if positive'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 4,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Loss of appetite" },
                    { text: "Followed by nausea" },
                    { text: "Present for 1+ weeks" },
                    { text: "Testicular symptoms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['appendicitis', 'pancreatitis', 'pregnancy', 'abdominal trauma'],
                                text: 'Periumbilical pain that moves to the right lower quadrant (RLQ) is a sign of appendicitis. Pancreatitis and appendicitis are often associated with a loss of appetite. Women of childbearing age should have their pregnancy status verified. Abdominal pain in the setting of pregnancy or recent abdominal trauma can signify an underlying issue. Chronic abdominal pain requires further evaluation by a qualified provider. New-onset benign, functional illness in a Soldier 50 plus years old is unlikely and should be evaluated further.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 5,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Nausea/vomiting" },
                    { text: "Diarrhea" },
                    { text: "Female pelvic pain" },
                    { text: "Constipation x 3 days" },
                    { text: "Urinary symptoms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['appendicitis', 'pancreatitis', 'pregnancy', 'abdominal trauma'],
                                text: 'Periumbilical pain that moves to the right lower quadrant (RLQ) is a sign of appendicitis. Pancreatitis and appendicitis are often associated with a loss of appetite. Women of childbearing age should have their pregnancy status verified. Abdominal pain in the setting of pregnancy or recent abdominal trauma can signify an underlying issue. Chronic abdominal pain requires further evaluation by a qualified provider. New-onset benign, functional illness in a Soldier 50 plus years old is unlikely and should be evaluated further.'
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[3],
                                text: "Screen nausea, diarrhea, pelvic pain, constipation, heartburn, urinary Sx, or other symptoms"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['gas', 'constipation', 'stress', 'viral illness'],
                                text: 'After significant underlying diseases have been ruled out, many causes of abdominal pain are not identified in the acute setting. Gas pain, constipation, stress are some of the potential other causes of the pain. The pain usually resolves on its own. Initial treatment includes hydration and a well-balanced, high fiber diet to help with any potential issues with constipation. A food diary looks for potential triggers. Follow-up if symptoms worsen, red flags, new symptoms, or no improvement in three days.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Initiate hydration with 8 glasses of water per day and a well-balanced, high fiber diet. Maintain a food diary to see if the symptoms are related to a particular food. Follow-up in 3 days if the symptoms have not resolved or earlier if symptoms worsen, new symptoms develop, or red flags become present',
                                    specLim: ['No running, jumping, riding in vehicle over uneven terrain', 'Aerobic activity at own pace/ distance', 'abdominal training at own intensity/ rep']
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "C-4",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Toilette FULL of Blood" },
                    { text: "Vomiting Blood or Coffee Grinds" },
                    { text: "Melena" },
                    { text: "Lightheaded" }
                ],
                answerOptions: []
            },
            {
                text: "Red Flags?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "Hemocult positive, Unable to obtain stool sample"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['instestinal bleed'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of hemodynamically significant stomach/ intestinal bleeding.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "weight loss" },
                    { text: "Night sweats" },
                    { text: "Family H/O early GI cancer" },
                    { text: "Change in stool" },
                    { text: "Mucous with stool" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['hypotension', 'intestinal bleed', 'hemorrhoid', 'anal fissure'],
                                text: 'Feeling lightheaded and orthostatic hypotension can be signs of significant blood loss. Hemoccult stool test can identify blood in the stool. Blood only on the outside of the stool or toilet paper is more likely to be from a hemorrhoid or anal fissure. If a stool sample cannot be obtained except by a rectal exam, then refer as “Provider Now” for the rectal exam. If a hemoccult stool test is not available, then Soldiers with blood on the outside of the stool or on the toilet paper only should be considered as negative. Blood mixed in with the stool should be treated as positive. If you are unsure, consider it positive.',
                                ancillaryFind: [
                                    {
                                        type: 'lab',
                                        modifier: 'hemoccult stool'
                                    }
                                ]
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "H/O anal sex" },
                    { text: "Low back problems" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['cancer', 'inflammatory bowel disease', 'invasive gastroenteritis'],
                                text: 'These are symptoms of more concerning disease processes to include cancer with a family history of colon cancer before 45 years old, inflammatory bowel disease, and invasive gastroenteritis.'
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['hemorrhoids', 'anal fissure'],
                                text: 'Hemorrhoids are enlarged veins around the rectum that protrude; get rubbed; and/or become painful from inflammation related to a small clot forming within the vein. Hemorrhoids are not dangerous but can be extremely uncomfortable. A Soldier who has a history of hemorrhoids or anal fissure and then develops similar symptoms likely has a recurrence. Soldier should be instructed on avoiding constipation since it is a common cause of hemorrhoids and anal fissures. Most people with itching (and no other symptoms) do not have a serious disease.", "MCP for hemorrhoids and anal fissures. To decrease the amount of irritation, the stool needs to be soft. Advise the Soldier to ensure adequate intake of fluids (8 glasses a day), eat foods high in fiber like bran cereal and fresh fruits and vegetables, and spend less than five minutes on the toilet at a time. Increase fiber slowly as too much fiber at once may cause stomach cramping and gas. Tell the Soldier that the area should be kept clean by washing with warm water and blotting (rather than wiping) dry. Sitting in warm water can improve healing. Polyethylene glycol (1st line) or docusate sodium (2nd line) can be used to help keep the stool soft. Hydrocortisone and pramoxine cream (3rd line) can be used if needed for inflammation and pain. Instruct the Soldier in its use and to return for evaluation if the symptoms worsen, new symptoms develop, or symptoms last longer than one week or recurs.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: '',
                                    medFind: [medList[36], medList[15], medList[22]]
                                }
                            }
                        ],
                        disposition: [Disposition[2]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "C-5",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Diarrhea at night" },
                    { text: "Iron deficiency anemia" },
                    { text: "Vomiting" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Weight change" },
                    { text: "Fatigue" },
                    { text: "Temperature sensitivity" },
                    { text: "Depression" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['hypothyroidism'],
                                text: 'These are symptoms of hypothyroidism. Soldiers that screen positive for possible hypothyroidism should be referred for further evaluation.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Rectal bleeding?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[3],
                                text: "Screen rectal bleeding or other symptoms if present"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['internal bleed'],
                                text: 'Rectal bleeding can be a sign of significant internal bleeding that requires further evaluation.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['constipation'],
                                text: 'The most important step in treating constipation is to alter the diet so that it contains plenty of fiber. Fiber is that part of food which is not absorbed into the body but instead remains in the intestines and absorbs water to form the bulk of the bowel movements. Without proper bulk, the large and small intestines cannot work properly, and this causes constipation. Fiber is present in bran cereal, whole wheat bread, fresh fruits, and vegetables. Ensure that the Soldier is taking adequate water (8 glasses a day). Laxatives can be used on a one-time basis but should not be used repeatedly because the body can become dependent on them. After the bisacodyl, use polyethylene glycol for two weeks (1st line) or docusate sodium for one week (2nd line) to prevent recurrence. Not everyone has a bowel movement every day. Bowel movements may occur as often as three times a day or once every three days and still be normal. Discomfort and a change in pattern are more reliable guides to a diagnosis of constipation. Instruct the Soldier to return for medical assistance if abdominal pain develops, if the interval between movements is three days or longer, or if blood appears in his or her stool.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Counsel the Soldier to drink 8 glasses of water per day and eat foods that are high in fiber. Medication: bisacodyl for acute constipation followed by a polyethylene glycol for 2 weeks (1st line) or docusate sodium for 1 week (2nd line). Return to clinic for blood in stool, abdominal pain, or not having a BM for 3 days',
                                    medFind: [medList[36], medList[15]]
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "C-6",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Airway compromise" },
                    { text: "Coughing, choking when swallowing" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply",
                type: "initial",
                questionOptions: [
                    { text: 'Red Flags' },
                    { text: 'Sudden onset during eating' },
                    { text: 'Inability to swallow (drooling)' }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "Include glucagon if unable to transport within 24 hours of onset"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['airway compromise'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Airway compromise is an emergency. Coughing, choking, or nasal regurgitation when initiating a swallow is a sign of decreased ability to maintain the airway. The Soldier is at risk for aspiration.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['acute food obstruction'],
                                text: 'Most common cause of dysphagia in an adult is an acute food obstruction. It is often due to swallowing a piece of meat that has not been fully chewed. Food obstruction will present with a feeling of something stuck in the throat and decreased or inability to swallow. The obstruction must be removed promptly. Complete obstruction should undergo an emergent endoscopy. A partial obstruction should undergo endoscopy within 24 hours. The esophagus can start to ulcerate and the risk of esophageal perforation increases after 24 hours. If endoscopic evaluation/ treatment is not available within 24 hours, see the treatment protocol below.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Do not administer meat tenderizers to Soldiers with an esophageal food impaction. It could cause serious esophageal injury. Glucagon can be administered to relax the esophagus as an initial attempt for the Soldier to spontaneously pass the food bolus when a referral for an endoscopic evaluation/ treatment is not available. Treatment must be prescribed by a supervising privileged provider.',
                                    medFind: [medList[19]],
                                    ancillaryFind: [
                                        {
                                            type: 'refer',
                                            modifier: 'endoscopy'
                                        }
                                    ]
                                }
                            }

                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Started before a sore throat?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Other causes of dysphagia not related to a sore throat should be evaluated by the AEM.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [
                            {
                                ...Disposition[3],
                                text: "Screen sore throat or other symptoms if present"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Dysphagia frequently accompanies a severe sore throat. However, MAKE CERTAIN that dysphagia did not precede the sore throat. Causes of dysphagia not associated with a sore throat may require a more extensive evaluation.'
                            }
                        ],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
        ]
    },
    {
        id: "C-7",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Vomiting Blood or Coffee Grinds" },
                    { text: "Melena" },
                    { text: "Angina" },
                    { text: "SOB" },
                    { text: "Radiation to Back" }
                ],
                answerOptions: []
            },
            {
                text: "Red Flags?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: 'Oxygen, EKG, chewable aspirin'
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['myocardial infarction', 'bleeding ulcer', 'dissecting aortic aneurysm'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems. Angina (substernal chest pressure, worse with exercise), shortness of breath, tachycardia, lightheaded, sweating, shoulder or jaw pain can be signs and symptoms of a myocardial infarction. Obtain an EKG and give aspirin (if no signs of bleeding). Do not wait to provide oxygen, give aspirin, and start IV before notifying the supervising privileged provider. Vomiting blood or coffee grinds and melena are signs of a bleeding ulcer. Tearing pain that radiates to the back is a sign of a dissecting aortic aneurysm.',
                                ancillaryFind: [
                                    {
                                        type: 'med',
                                        modifier: 'aspirin'
                                    },
                                    {
                                        type: 'protocol',
                                        modifier: 'ekg'
                                    }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Tachycardia" },
                    { text: "Sweating" },
                    { text: "Shoulder/Jaw Pain" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "Oxygen, EKG, chewable aspirin"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['myocardial infarction', 'bleeding ulcer', 'dissecting aortic aneurysm'],
                                text: 'Oxygen, EKG, and chewable aspirin. Angina (substernal chest pressure, worse with exercise), shortness of breath, tachycardia, lightheaded, sweating, shoulder or jaw pain can be signs and symptoms of a myocardial infarction. Obtain an EKG and give aspirin (if no signs of bleeding). Do not wait to provide oxygen, give aspirin, and start IV before notifying the supervising privileged provider. Vomiting blood or coffee grinds and melena are signs of a bleeding ulcer. Tearing pain that radiates to the back is a sign of a dissecting aortic aneurysm.',
                                ancillaryFind: [
                                    {
                                        type: 'med',
                                        modifier: 'aspirin'
                                    },
                                    {
                                        type: 'protocol',
                                        modifier: 'ekg'
                                    }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "> 2 weeks" },
                    { text: "History of ulcer" },
                    { text: "Unexplained wt loss" },
                    { text: "Anorexia, vomiting" },
                    { text: "Dysphagia" },
                    { text: "Odynophagia" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['gastritis', 'ulcer', 'cancer', 'pancreatitis', 'esophagitis', 'GERD'],
                                text: 'These are symptoms that suggest a more chronic condition than just heartburn. History of an ulcer suggests gastritis or another ulcer. Unexplained weight loss is a sign of cancer. Anorexia and vomiting are signs of pancreatitis. Dysphagia and odynophagia are signs of esophagitis and chronic gastroesophageal reflux disease.'
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 4,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Classic symptoms of heartburn?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['GERD'],
                                text: 'It occurs due to the passage of gastric contents into the esophagus. It is a normal physiologic process that can result in brief episodes of heartburn. Overeating, tobacco, alcohol, overweight, stress, certain foods can act as triggers to increase the frequency of heartburn.", "Instruct Soldier on lifestyle modifications: weight loss if overweight, smoking cessation if indicated, and elevation of head of bed, avoidance of chocolate/caffeine/spicy foods/ alcohol/other foods that exacerbate symptoms. Ranitidine (histamine 2 receptor antagonist) as needed for symptoms. Ranitidine reaches peak of action about 2.5 hours after taking and lasts around 8 hours. Return if symptoms are not controlled with minor-care measures, new symptoms arise, or Soldier is having to take the over the counter medication more than once per week.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: '*NOTE: updated clinical practice - Ranitidine is no longer used* Medication: Ranitidine as needed (up to 2 doses in 24 hours) Lifestyle modification: weight loss if indicated, smoking cessation if indicated, elevation of head of bed, avoidance of foods that make it worse. Return to clinic if any of the red flags or other symptoms develop, not improved with Minor Care Protocol, or taking ranitidine more than once per week on average.',
                                    medFind: [medList[40]]
                                }
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [
                            {
                                ...Disposition[3],
                                text: "Screen other symptoms if present"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Soldier without the previous concerning symptoms and classic heartburn symptoms can be treated with over the counter medications and lifestyle changes. If other symptoms are present, he or she should be screened for those symptoms.'
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "D-1",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Cyanosis" },
                    { text: "Ancillary muscles" },
                    { text: "SpO2<90%" },
                    { text: "SIRS Criteria" },
                    { text: "Airway Swelling" },
                    { text: "Hives" },
                    { text: "Altered Mental Status (AMS)" }
                ],
                answerOptions: []
            },
            {
                text: "Red Flags?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[0], modifier: "Oxygen, EKG, IV" }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now”. Start the Soldier on oxygen with non-rebreather mask at 10 Liters/ minute, start an IV and IVF at TKO and obtain EKG if available. They can be signs of significant underlying medical problems.',
                                ancillaryFind: [
                                    {
                                        type: 'med',
                                        modifier: 'aspirin'
                                    },
                                    {
                                        type: 'protocol',
                                        modifier: 'EKG'
                                    },
                                    {
                                        type: 'protocol',
                                        modifier: 'IV and IVF at TKO'
                                    }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "EKG",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Irregular pulse" },
                    { text: "Sweating" },
                    { text: "Chest, shoulder, jaw pain or pressure" },
                    { text: "H/O or FH of heart problems" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "Oxygen, EKG, Aspirin 325mg"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['myocardial infarction', 'pulmonary embolism', 'arrhythmia'],
                                text: 'Tachycardia, sweating, pain or pressure in the chest, shoulder, or jaw can be symptoms of a myocardial infarction. Chest pain and tachycardia can also be signs of a pulmonary embolism. Irregular pulse identifies an arrhythmia. Do not wait to provide oxygen, give aspirin, and start IV before notifying the supervising privileged provider.',
                                ancillaryFind: [
                                    {
                                        type: 'med',
                                        modifier: 'aspirin'
                                    },
                                    {
                                        type: 'protocol',
                                        modifier: 'EKG'
                                    },
                                    {
                                        type: 'protocol',
                                        modifier: 'Oxygen'
                                    }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Elevated temperature" },
                    { text: "Productive cough" },
                    { text: "Symptoms > 10 days" },
                    { text: "H/O asthma wheeze" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['pneumonia', 'viral illness', 'asthma'],
                                text: 'Screens for other medical conditions requiring further evaluation. Productive cough and elevated temperature are signs of pneumonia. Symptoms lasting longer than 10 days may not be viral. History of asthma or wheezing screens for an asthma exacerbation.'
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 4,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Cold like symptoms" },
                    { text: "Allergy symptoms" },
                    { text: "H/O panic attacks" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['cold'],
                                text: 'Counsel the Soldier to drink plenty of fluids and rest, cover their mouth when they cough and wash hands to prevent spread. Ibuprofen for pain, acetaminophen for elevated temperature, decongestant for nasal congestion, guaifenesin for mucous, or antihistamine for allergies. Return to clinic if not improving within one week, worsening symptoms, fever, new sinus pain, lightheadedness, or pain in the neck.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Cold or allergy symptoms: A-3 Minor Care Protocol',
                                    medFind: [medList[23], medList[0], medList[32], medList[20], medList[27]]
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['panic attack'],
                                text: 'Check EKG. If EKG is normal, initiate observed deep breathing exercises. Place a pulse oximeter on the Soldier’s finger. Have the Soldier lay back at a 45 degree angle with legs uncrossed and initiate diaphragmatic breathing exercises with deep, slow inhalation over 4 seconds and exhalation over another 4 second count. If the SpO2 starts to drop, disposition the Soldier as “Provider Now”. Refer Soldier to Behavioral Health after initial panic attack decreases in intensity.',
                                assocMcp: {
                                    type: 'mcp',
                                    ancillaryFind: [
                                        {
                                            type: 'refer',
                                            modifier: 'Behavioral Health'
                                        },
                                        {
                                            type: 'protocol',
                                            modifier: 'EKG'
                                        }
                                    ]

                                }
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Identifies conditions that are self-limited or can be treated with a minor-care protocol.'
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "D-2",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Irregular Pulse" },
                    { text: "H/O or FH of Heart Problems" },
                    { text: "Shoulder, jaw pain or pressure" }
                ],
                answerOptions: []
            },
            {
                text: "EKG",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Abnormal vitals" },
                    { text: "Abnormal EKG" },
                    { text: "40+ years old" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['myocardial infarction', 'pulmonary embolism', 'arrhythmia'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now”. Start them on oxygen with a nasal cannula at four-six liters/ minute, start an IV and IVF at TKO, give a chewable aspirin. These can be signs of significant underlying medical problems., ',
                                ancillaryFind: [
                                    {
                                        type: 'protocol',
                                        modifier: 'EKG'
                                    },
                                    {
                                        type: 'med',
                                        modifier: 'Aspirin'
                                    },
                                    {
                                        type: 'protocol',
                                        modifier: 'O2 nasal cannula 4-6 liters/min'
                                    },
                                    {
                                        type: 'protocol',
                                        modifier: 'IV / IVF TKO'
                                    }
                                ]
                            },
                            {
                                type: 'dmp',
                                ddx: ['myocardial infarction', 'pulmonary embolism', 'arrhythmia'],
                                text: 'Obtain an EKG if available. Tachycardia, sweating, pain, and pressure in the chest, shoulder, or jaw can be symptoms of a myocardial infarction. Note that diabetics and women can present atypically. Chest pain and tachycardia can also be signs of a pulmonary embolism or arrhythmia. Do not wait to provide oxygen, give aspirin, and start IV before notifying the supervising privileged provider.',
                                ancillaryFind: [
                                    {
                                        type: 'rad',
                                        modifier: 'EKG'
                                    },
                                    {
                                        type: 'med',
                                        modifier: 'Aspirin'
                                    },
                                    {
                                        type: 'med',
                                        modifier: 'O2 nasal cannula 4-6 liters/min'
                                    },
                                    {
                                        type: 'med',
                                        modifier: 'IV / IVF TKO'
                                    }
                                ]
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "Oxygen, EKG, Aspirin 325mg"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Productive cough >7 days" },
                    { text: "Elevated temperature" },
                    { text: "Symptoms > 10 days" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['pneumonia', 'rib fracture'],
                                text: 'Elevated temperature and productive cough screens for pneumonia. Recent chest trauma screens for multiple etiologies to include a rib fracture.',
                                ancillaryFind: [
                                    {
                                        type: 'rad',
                                        modifier: 'chest x-ray'
                                    }
                                ]
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 4,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Cold like symptoms" },
                    { text: "Reproducible chest pain" },
                    { text: "Heartburn" },
                    { text: "H/O panic attacks" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['cold'],
                                text: 'See Protocol A-3. Must discuss with supervising privileged provider before Soldier leaves screening area.',
                                assocMcp: {
                                    text: 'Counsel the Soldier to drink plenty of fluids, get plenty of rest, and to cover their mouth when coughing and wash their hands to prevent spread. Stop or limit smoking. Ibuprofen for pain, Acetaminophen for elevated temperature, decongestant for nasal congestion, guaifenesin for mucous, or antihistamine for allergies. Return if it does not improve in 7 days, worsening symptoms, develop sinus pain, lightheaded, neck pain, or fever.',
                                    medFind: [
                                        { ...medList[23] },
                                        { ...medList[0] },
                                        { ...medList[32] },
                                        { ...medList[20] }
                                    ],
                                    specLim: [
                                        'Consider quarters/ contagious precautions while febrile',
                                        'Aerobic training at own pace/distance x 3 days',
                                        'Limit exposure to temperatures below <50 degrees F'
                                    ]
                                },
                            },
                            {
                                type: 'dmp',
                                ddx: ['panic attack'],
                                text: '(chest tightness, palpitations, anxious, lightheaded): Check EKG. If EKG is normal, initiate observed deep breathing exercises. Place a pulse oximeter on the Soldier’s finger. Have the Soldier lay back at a 45 degree angle with legs uncrossed and initiate diaphragmatic breathing exercises with deep, slow inhalation over 4 seconds and exhalation over another 4 second count. If the SpO2 starts to drop, disposition the Soldier as “Provider Now”. Refer Soldier to behavioral health after initial panic attack decreases in intensity. Must discuss with supervising privileged provider before Soldier leaves screening area',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Check EKG. Monitor pulse oximeter. Supervised deep breathing exercises. Referral to provider now if oxygenation decreases or symptoms do not resolve. Refer to behavioral health after dyspnea symptoms have resolved',
                                    ancillaryFind: [
                                        {
                                            type: 'refer',
                                            modifier: 'behavioral health'
                                        }
                                    ],
                                    specLim: [
                                        'Limit exposure to temperatures below <50 degrees F'
                                    ]
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['costochondritis', 'Tietze Syndrome'],
                                text: 'Pain must be reproducible and directly correspond to a supporting history. Medications: ibuprofen as needed for muscle complaints. Return to clinic if pain increases, lasts longer than three days, shortness of breath/ dizziness/ or new symptoms develop. Must discuss with supervising privileged provider before Soldier leaves screening area.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'ibuprofen or acetaminophen for pain, analgesic balm for muscle/tendons. Temporary profile x 3 days if needed. Return to the clinic if pain increases, not improved in four days, shortness of breath/dizziness/or new symptoms develop.',
                                    ancillaryFind: [],
                                    specLim: [
                                        'May lift, push up to 25 lbs'
                                    ]
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['GERD', 'heartburn'],
                                text: 'Must discuss with supervising privileged provider before Soldier leaves screening area. This occurs due to the passage of gastric contents into the esophagus. It is a normal physiologic process that can result in brief episodes of heartburn. Overeating, tobacco, alcohol, overweight, stress, certain foods can act as triggers to increase the frequency of heartburn.", "Instruct Soldier on lifestyle modifications: weight loss if overweight, smoking cessation if indicated, and elevation of head of bed, avoidance of chocolate/caffeine/spicy foods/ alcohol/other foods that exacerbate symptoms. Ranitidine (histamine 2 receptor antagonist) as needed for symptoms. Ranitidine reaches peak of action about 2.5 hours after taking and lasts around 8 hours. Return if symptoms are not controlled with minor-care measures, new symptoms arise, or Soldier is having to take the over the counter medication more than once per week.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: '*NOTE: updated clinical practice - Ranitidine is no longer used* Medication: Ranitidine as needed (up to 2 doses in 24 hours) Lifestyle modification: weight loss if indicated, smoking cessation if indicated, elevation of head of bed, avoidance of foods that make it worse. Return to clinic if any of the red flags or other symptoms develop, not improved with Minor Care Protocol, or taking ranitidine more than once per week on average.',
                                    medFind: [medList[40]]
                                }
                            }
                        ],
                        disposition: [Disposition[2]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ' Conditions that are not identified should be referred to the AEM for further evaluation.'
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "E-1",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Systemic Inflammatory Response Syndrome" },
                    { text: "Flank Pain" },
                    { text: "Severe Abdominal Pain" },
                    { text: "Gross Hematuria or Passing Blood Clots" }
                ],
                answerOptions: []
            },
            {
                text: "\u2640  Pregnancy Test",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Fever T>100.4" },
                    { text: "H/O diabetes" },
                    { text: "Nausea and vomiting" },
                    { text: "Vaginal symptoms" },
                    { text: "Vulvar ulcer" },
                    { text: "Pain with intercourse" },
                    { text: "Cola colored urine" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems. '
                            },
                            {
                                type: 'dmp',
                                ddx: ['urinary tract infection', 'kidney infection', 'systemic infection', 'diabetes'],
                                text: 'Urinary tract infections can get worse if not promptly treated. Urinary tract infection can progress to a kidney infection and then a systemic infection through the blood. Uncontrolled diabetes can present with increased urination and nausea with vomiting. Complaints requiring an invasive exam are referred to the supervising privileged provider.',
                                ancillaryFind: [
                                    {
                                        type: 'lab',
                                        modifier: "urinalysis, urine culture if available"
                                    },
                                    {
                                        type: 'lab',
                                        modifier: "pregnancy test"
                                    }
                                ]
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "UA, urine culture if available"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Male" },
                    { text: "H/O kidney stones" },
                    { text: "Pregnant" },
                    { text: "Recent urinary catheter" },
                    { text: "Red urine, not menstrual cycle related" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['kidney stone', 'recurrent urinary tract infection', 'atypical bacterial infection', 'STD', 'hematuria'],
                                text: 'Urinary complaints in a male are more likely to be something other than a urinary tract infection. Recurrent urinary tract infections (UTIs), recent urinary catheterization, and immunocompromised are more likely to have an atypical bacterial infection.',
                                ancillaryFind: [
                                    {
                                        type: 'lab',
                                        modifier: 'urinalysis, urine culture'
                                    }
                                ]
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[1],
                                modifier: "UA, urine culture if available"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['cystitis (urinary tract infection)'],
                                text: 'UA and urine culture should be completed if resources are available. A Soldier with symptoms consistent with a UTI can be empirically treated without a urinalysis after ruling out any history that would increase the Soldier’s risk and determining any allergies to medications. Instruct the Soldier about the importance of increasing fluid intake to flush out the bacteria. OTC medication: phenazopyridine as needed for pain. Instruct the Soldier that it will likely dye his or her urine orange. It may also stain contact lenses from transferring the dye from the fingers to the contacts, if worn. Antibiotics: Trimethoprim/ Sulfamethoxazole is the first line agent. Nitrofurantoin is the second line agent if the Soldier is allergic to sulfa drugs or there is local resistance to the first line agent. Return to clinic if symptoms are not improving within 24 hours, development of new symptoms, or worsening symptoms despite treatment.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'drink 8+ glasses of water/day. Phenazopyridine as needed. Counsel on it changing urine orange and potential to dye contacts. First line agent: trimethoprim/sulfamethoxazole. if the MTF antibiotic resistance is greater than 20% or patient has sulfa allergy, use second line agent. Second line agent: nitrofurantoin, if the patient reports an allergy to nitrofurantoin. refer to AEM. Return to clinic if symptoms not improving within 24 hours, development of new symptoms, worsening symptoms ',
                                    medFind: [medList[35], medList[42], medList[31]]
                                }
                            }
                        ],
                        disposition: [Disposition[2]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "E-2",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Pain with testes supported" },
                    { text: "Suspect Stress Fracture (increased with weight bearing or during exercise, endurance training, change in exercise routine)" },
                    { text: "Severe Pain" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Nausea and vomiting" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: 'Stress fracture: crutches with toe touching weight bearing'
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['testicular torsion', 'hernia', 'stress fracture'],
                                text: 'Severe pain at rest with the testes supported can be a sign of testicular torsion or a hernia. Immediate referral is needed for further evaluation and potential treatment. Pain with standing or increasing during exercise can be a sign of a stress fracture of the hip. Change in activity or endurance training are risk factors for a stress fracture. Suspected stress fractures should be toe touch weight bearing and get immediate evaluation. Nausea and vomiting could represent severe pain or be a sign of a hernia.',
                                ancillaryFind: [
                                    {
                                        type: 'protocol',
                                        modifier: 'crutches. toe touching weight bearing'
                                    }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Hematuria?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['Sexually transmitted Infection', 'hip injury'],
                                text: 'Pain that has lasted for over 2 weeks is less likely to be an acute muscle strain and could represent an injury to the hip joint requiring further evaluation. Urologic symptoms, like hematuria, require further evaluation.',
                                ancillaryFind: [
                                    {
                                        type: 'lab',
                                        modifier: 'UA, urine culture'
                                    },
                                    {
                                        type: 'lab',
                                        modifier: 'STD screen'
                                    },
                                ]
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[1],
                                modifier: 'STD Screen and UA'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['epididymitis'],
                                text: 'Pain is often improved with testicular support. Instruct the Soldier on the importance of wearing supportive underwear (briefs, jock strap), application of ice to decrease the swelling. Medication: ibuprofen, acetaminophen, topical muscle balm, ice and heat as needed for pain, inflammation, and swelling or ketorolac for moderate pain.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Intermittent ice and testicular support if improved with support Activity modification as appropriate Medication: Ibuprofen (1st line) and ketorolac (2nd line) as needed for moderate pain Provide screening, treatment, and counseling if present with urologic symptoms. RTC if worsening pain, new symptoms arise, or not improved within 1 week',
                                    medFind: [medList[23], medList[24]],
                                    specLim: ['Walk at own pace/distance', 'No running, jumping, riding in military vehicle over uneven terrain', 'May stand for up to 15min']
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['muscle/tendon strain'],
                                text: 'Pain is often worse with activity. Instruct the Soldier on the home exercise program in accordance with local protocol. Medication: ibuprofen, acetaminophen, topical muscle balm, ice and heat as needed for pain, inflammation, and swelling or ketorolac for moderate pain. Activity modification. Return to clinic if symptoms are not improving within 48 hours, development of new symptoms, or worsening symptoms',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Provide home exercise program, intermittent ice or heat IAW local protocol if worse with activity',
                                    medFind: [medList[23], medList[0], medList[28]],
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['gonorrhea', 'chlamydia'],
                                text: 'Request an order for a urinalysis and gonorrhea/chlamydia urine screen. If urethral discharge is present, 2+ white blood cells (WBCs) on urinalysis, leukocyte esterase positive on urinalysis, or recent known STI exposure, treat for potential gonorrhea/chlamydia infection with ceftriaxone and azithromycin. Instruct the Soldier that the condition is contagious and to abstain from intercourse for 1 week after treatment. Notify the supervising privileged provider so that he or she can track. Refer to community health. Return to clinic if symptoms are not improving within 48 hours, development of new symptoms, or worsening symptoms.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Provide screening. if urethral discharge is present, or recent known STI exposure, treat for potential Gonorrheal/Chlamydia infection with ceftriaxone and azithromycin. Instruct the Soldier that the condition is contagious and to abstain from intercourse for 1 week after treatment. Notify provider, Refer to community health. RTC if symptoms are not improving within 48 hours, development of new symptoms or worsening symptoms',
                                    ancillaryFind: [
                                        {
                                            type: 'refer',
                                            modifier: 'community health'
                                        },
                                        {
                                            type: 'lab',
                                            modifier: 'urinalysis'
                                        },
                                        {
                                            type: 'lab',
                                            modifier: 'Gonorrhea'
                                        },
                                        {
                                            type: 'lab',
                                            modifier: 'Chlamydia'
                                        },
                                    ],
                                    medFind: [medList[13], medList[6]],
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "E-3",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Female Pelvic Pain with Intercourse" },
                    { text: "Pregnant" },
                    { text: "Orthostatic, Fever" }
                ],
                answerOptions: []
            },
            {
                text: "Draw the following labs",
                type: "action",
                questionOptions: [
                    { text: '\u2640  Pregnancy Test' },
                    { text: 'STD Screen' },
                    { text: 'Urinalysis' },
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Worsening despite treatment" },
                    { text: "Severe illness" },
                    { text: "Vaginal symptoms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['Testicular Torsion', 'Hernia', 'Stress Fracture', 'Hip Injury', 'STD'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['Ectopic Pregnancy', 'Syphilis', 'Gonorrhea', 'Chlamydia', 'Pelvic Inflammatory Disease', 'Sepsis'],
                                text: 'All Soldiers will be screened with a pregnancy test (if female), UA, and STI screen. STI screen will consist of a RPR, gonorrhea/chlamydia urine screen, and HIV screen. Pelvic pain with intercourse may be pelvic inflammatory disease. Orthostatic symptoms, fever, and signs of a severe illness can represent a more significant problem. Signs of a severe illness includes abnormal vital signs, appearing pale, sweaty, lethargic, or visually in pain. Failure of initial treatment may be a drug resistant organism. Females with vaginal symptoms to include discharge will be referred to a privileged provider for a pelvic examination.',
                                ancillaryFind: [
                                    {
                                        type: 'lab',
                                        modifier: 'pregnancy test'
                                    },
                                    {
                                        type: 'lab',
                                        modifier: 'gonorrhea/chlamydia urine screen'
                                    },
                                    {
                                        type: 'lab',
                                        modifier: 'HIV screen'
                                    },
                                    {
                                        type: 'lab',
                                        modifier: 'Urinalysis'
                                    }
                                ]
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Skin lesion" },
                    { text: "Rash" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['syphilis', 'HSV', 'genital warts', 'chancroid', 'molluscum contagiosum'],
                                text: 'Skin lesions/rash may represent a chancre (syphilis), HSV ulcers, genital warts (HPV), chancroid, or molluscum contagiosum. Further evaluation is necessary to determine the necessary treatment modality (freezing, medication, or referral)'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['gonorrhea', 'chlamydia'],
                                text: 'Request an order for a urinalysis and gonorrhea/chlamydia urine screen. If urethral discharge is present, 2+ WBC on urinalysis, leukocyte esterase positive on urinalysis, or recent known STI exposure, treat for potential gonorrhea/chlamydia infection with ceftriaxone and azithromycin. Instruct the Soldier to abstain from intercourse for one week after treatment due to contagious risk and counsel on safe sex practices and risks of high risk sexual behavior. Notify the supervising privileged provider so that he or she can track. Refer to community health. Return to clinic if symptoms are not improving within 48 hours, development of new symptoms, or worsening symptoms.',
                                assocMcp: {
                                    type: 'mcp',
                                    // updated empiric treatment guideline if unknown GC/CT - ceftriaxone 500mg IM x 1 in clinic + doxycycline 100mg PO BID x 7 days.
                                    text: '*NOTE: updated empiric treatment for GC/CT involves ceftriaxone with doxycycline in place of azithromycin* Counsel on avoidance of sexual contact till diagnosis has been confirmed/ruled-out, safe sex practices, and risks of high risk sexual behavior. STD Screen. Provide treatment with ceftriaxone and arithromycin if positive or symptomatic. Notify provider. Refer to community health. RTC if worsening symptoms, new symptoms arise, or not improving within 2 days ',
                                    ancillaryFind: [
                                        {
                                            type: 'lab',
                                            modifier: 'gonorrhea/chlamydia urine screen'
                                        },
                                        {
                                            type: 'lab',
                                            modifier: 'HIV screen'
                                        },
                                        {
                                            type: 'lab',
                                            modifier: 'Urinalysis'
                                        },
                                        {
                                            type: 'refer',
                                            modifier: 'Community Health'
                                        }
                                    ],
                                    medFind: [medList[13], medList[6], medList[16]]
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "E-4",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Inability to void x 12 hours" },
                    { text: "Fever" },
                    { text: "Cola Colored Urine" },
                    { text: "Blood or Clots in Urine" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Worsening despite treatment" },
                    { text: "Severe illness" },
                    { text: "Vaginal symptoms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['urinary obstruction', 'benign prostatic hypertrophy', 'UTI', 'STI'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems. Inability to void can represent an obstruction of the ureter. Do to the risks to the kidneys, it is a medical emergency.'
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "Urinalysis, \u2640 Pregnancy Test"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: [2, 3],
                        selectAll: false
                    }
                ]
            },
            {
                text: 'Draw the following labs if applicable',
                type: 'action',
                questionOptions: [
                    { text: 'Urinalysis' },
                    { text: '\u2640 Pregnancy Test' },
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Pregnant" },
                    { text: "Male > 40 yrs old" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['benign prostatic hyperplasia'],
                                text: 'A man’s prostate can become enlarged later in life resulting in urinary symptoms of post-void urine dribbling, a weak stream, or difficulty initiating a urinary stream that requires further evaluation and treatment by a qualified provider.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['pregnancy'],
                                text: 'See algorithm I-2: Refer Soldiers with a positive pregnancy test to the AEM. The Soldier will need to receive initial pregnancy counseling that includes medications and foods to avoid, importance of a daily prenatal vitamin, avoidance of alcohol, pregnancy profile, and referral to obstetrics-gynecology clinic. These services are also sometimes provided by the clinic nurse depending on local protocol'
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['gonorrhea', 'chlamydia'],
                                text: 'For Urethral Discharge See Protocol E-3. Check a first morning void urinalysis and gonorrhea/chlamydia urine screen. If indicated, treat for potential gonorrhea/chlamydia infection with ceftriaxone and azithromycin. Instruct the Soldier to abstain from sex due to the contagious risk. Notify the supervising privileged provider. Refer to community health. RTC if symptoms have not improved in 1 week, symptoms worsen, or new symptoms develop.',
                                assocMcp: {
                                    type: 'mcp',
                                    // updated empiric treatment guideline if unknown GC/CT - ceftriaxone 500mg IM x 1 in clinic + doxycycline 100mg PO BID x 7 days.
                                    text: '*NOTE: updated empiric treatment for GC/CT involves ceftriaxone with doxycycline in place of azithromycin* Counsel on avoidance of sexual contact till diagnosis has been confirmed/ruled-out, safe sex practices, and risks of high risk sexual behavior. STD Screen. Provide treatment with ceftriaxone and arithromycin if positive or symptomatic. Notify provider. Refer to community health. RTC if worsening symptoms, new symptoms arise, or not improving within 2 days ',
                                    ancillaryFind: [
                                        {
                                            type: 'lab',
                                            modifier: 'gonorrhea/chlamydia urine screen'
                                        },
                                        {
                                            type: 'lab',
                                            modifier: 'HIV screen'
                                        },
                                        {
                                            type: 'lab',
                                            modifier: 'Urinalysis'
                                        },
                                        {
                                            type: 'refer',
                                            modifier: 'Community Health'
                                        }
                                    ],
                                    medFind: [medList[13], medList[6], medList[16]]
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['UTI'],
                                text: 'UTI : See Protocol E-1. OTC medication: phenazopyridine as needed for pain. Antibiotics: trimethoprim/sulfamethoxazole is the first line agent. Nitrofurantoin is the second line agent. Return to clinic in 24 hours if symptoms are not improving, worsening symptoms, or developing new symptoms.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'drink 8+ glasses of water/day. Phenazopyridine as needed. Counsel on it changing urine orange and potential to dye contacts. First line agent: trimethoprim/sulfamethoxazole. if the MTF antibiotic resistance is greater than 20% or patient has sulfa allergy, use second line agent. Second line agent: nitrofurantoin, if the patient reports an allergy to nitrofurantoin. refer to AEM. Return to clinic if symptoms not improving within 24 hours, development of new symptoms, worsening symptoms ',
                                    medFind: [medList[35], medList[42], medList[31]]
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['urinary incontinence', 'stress incontinence'],
                                text: 'If leaking urine during episodes of increased intra-abdominal pressure (sneezing, coughing, laughing, jumping), it is stress incontinence. Instruct the Soldier on performing Kegel exercises at home. Contact the clinic if not improving and would like a referral. Return for worsening or development of new symptoms.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'if leaking urine when coughing, sneeing, jumping, counsel patient on home exercises. RTC if worsening symptoms, new symptoms arise, or not improved within stated timeframe'
                                }
                            }
                        ],
                        disposition: [Disposition[2]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "F-1",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Abnormal Vital Signs" },
                    { text: "Irregular Pulse" },
                    { text: "Witnessed or H/O Seizure" },
                    { text: "Severe Headache" },
                    { text: "Heat Injury" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Suspect drugs/alcohol" },
                    { text: "Altered mental status" },
                    { text: "Unstable gait" },
                    { text: "Diabetic" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['Orthostatic Hypotension', 'Intracranial Bleed', 'Seizure', 'hypo/hyperglycemia'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems. Take orthostatic blood pressure. Severe headache associated with trauma can represent an intracranial bleed. Heat injuries can be life-threatening and require prompt action. Soldier acting abnormal or intoxicated, with abnormal pupils, an unsteady gait, loss of coordination, slurred speech, or appearing unkempt should be referred for further evaluation. Hypo/hyperglycemia can also result in altered mental status and progress to a coma.',
                                ancillaryFind: [
                                    { type: 'protocol', modifier: 'if hypotensive: start IVG' },
                                    { type: 'protocol', modifier: 'if irregular pulse: EKG' },
                                    { type: 'protocol', modifier: 'if heat exposure: cool' }
                                ]
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "Hypotensive - start IVF. Irregular pulse - EKG. Heat exposure - Cool"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Vertigo" },
                    { text: "Appears anxious" },
                    { text: "Prevent normal duties" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['anxiety', 'vertigo'],
                                text: 'Anxiety with hyperventilation can result in dizziness. Soldiers with vertigo will require further evaluation and medications for treatment.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['reflex syncope'],
                                text: 'Common reflex syncope situations include prolonged standing in formation, seeing/ giving blood, or especially stressful situation. Have the Soldier lay down in a comfortable position and elevate the legs, if possible. Continue to monitor the Soldier for 30 minutes after the symptoms have resolved. Reassure the Soldier that it is a common and benign condition. Instruct the Soldier to increase water and salt intake, watch for the prodromal signs (lightheaded, flushing/ feeling of warmth, sweating, tunnel vision/ changes in vision progressing to blindness, nausea, appearing pale), and actions to take when the symptoms start. Laying down with the legs raised or sitting when not able to lay down, clenching the fist, or leg pumping (crossing and flexing legs) or some ways that can help relieve symptoms.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Reflex syncope situation/symptoms before incident, have the patient lay down wth legs uncrossed and elevated until symptoms resolve. Observe the patient for 30 minutes after symptoms resolved to make sure that the symptoms do not return. Counsel the patient to increase electrolyte intake. Counsel the patient on situations that increase risk of reoccurrence, symptoms to watch for, and early interventions to take. RTC if worsening symptoms, new symptoms arise, or recurrence of incident.',
                                    specLim: ['No driving x 72 hours']
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    // No current algorithm exists for headache F-2. Decision making points exist. This algorithm was made by working backwards from decision making points. 2009 version of ADTMC does not adequately address red flags.
    {
        id: "F-2",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Sudden Onset, Severe" },
                    { text: "Focal Neurologic Signs" },
                    { text: "Blown pupil" },
                    { text: "Severe Hypertension" },
                    { text: "Fever" },
                    { text: "Vision Change/Loss" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Hypertension > 220/110" },
                    { text: "Abnormal pupils" },
                    { text: "sudden worst headache" },
                    { text: "fever" },
                    { text: "inability to touch chin to chest" },
                    { text: "altered mental status" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[0],
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.',

                            },
                            {
                                type: 'dmp',
                                ddx: ['hypertensive emergency', 'hypertensive urgency', 'increased intracranial pressure', 'intracranial hemorrhage', 'meningitis'],
                                text: 'Severe hypertension is a blood pressure over 220 systolic or 110 diastolic. When a Soldier has severe hypertension, have them lay down in a quiet, dark room until able to transport them to a higher level of care. A blown pupil can be a sign of increased intracranial pressure. Sudden worst headache of the Soldier’s life and focal neurological sign can be a sign of an intracranial hemorrhage. Fever and inability to touch the chin the chest are signs of meningitis. Altered mental status can be a sign of a more significant problem. If there is some question as to whether or not the Soldier is confused, ask him simple questions such as his name, day of the week, the year, where he is now, or who is the President of the United States?',
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "nausea" },
                    { text: "high blood pressure" },
                    { text: "Failing initial treatment" },
                    { text: "change from usual headache" },
                    { text: "pregnant" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['migraine', 'increased intracranial pressure', 'hypertension', 'secondary headache', 'pre-eclampsia'],
                                text: 'Nausea is a common symptom with a migraine headache but can also be a sign of increased intracranial pressure. Nausea requires a further evaluation to determine the most likely cause. Uncontrolled high blood pressure can result in a headache and requires additional treatment. Headaches that have failed initial treatment need to be evaluated for secondary causes and a different medication regiment. A change from a Soldier’s usual headache can represent a more significant underlying medical problem or new cause of the headache. Pregnancy limits the medications that can be used, and headache in pregnancy could represent pre-eclampsia if over 20 weeks pregnant.',
                                ancillaryFind: [
                                    {
                                        type: 'lab',
                                        modifier: '\u2640 Pregnancy Test'
                                    }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'mcp',
                                ddx: ['migraine headache', 'tension headache', 'caffeine withdrawal'],
                                text: 'Provide the Soldier with ibuprofen, naproxen, or ketorolac as needed for his or her headache. Return to clinic if confusion, vision problems, nausea, or fever develop, if the pain is so severe that performance of normal duties is impossible, or the headache lasts over 24 hours. May provide physical activity modification for one day, if necessary.',
                                medFind: [medList[23], medList[30], medList[24]],
                                specLim: ['May wear Sunglasses Indoors', 'Limit loud noises', 'Walk at own pace/distance', 'No running, rucking, jumping']
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "F-3",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Sudden Onset, Severe" },
                    { text: "Focal Neurologic Signs" },
                    { text: "Blown pupil" },
                    { text: "Severe Hypertension" },
                    { text: "Fever" },
                    { text: "Vision Change/Loss" }
                ],
                answerOptions: []
            },
            {
                text: "Draw the following labs",
                type: "action",
                questionOptions: [
                    { text: "Finger stick glucose" },
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "red flags" },
                    { text: "back pain" },
                    { text: "severe headache" },
                    { text: "blood glucose < 70" },
                    { text: "Diabetes / insulin" },
                    { text: "tick exposure" },
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: 'Glucose < 70 provide sugar/food if available'
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems',

                            },
                            {
                                type: 'dmp',
                                ddx: ['neuropathy', 'herniated disc', 'intracranial lesion', 'hypoglycemia'],
                                text: 'Localized issue is more likely to have a serious cause then generalized symptoms. Back pain can represent a herniated disc causing nerve compression. Severe headache can represent an intracranial lesion. Insulin use, or history of diabetes can present with symptomatic hypoglycemia. In hypoglycemic Soldiers, sugar or food should be provided if available.',
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: [3, 4],
                        selectAll: false
                    }
                ]
            },
            {
                text: "Draw the following lab if applicable",
                type: "action",
                questionOptions: [
                    {
                        text: '\u2640 Pregnancy Test'
                    }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Fever" },
                    { text: "prevents normal activities" },
                    { text: "first occurrence of symptoms" },
                    { text: "pregnant" },
                    { text: "depressed" },
                    { text: "35+ years old" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['viral illess', 'depression', 'pregnancy-related pathology'],
                                text: 'Fatigue from an infectious illness can be described as weakness. First occurrence of symptoms or being 35 years old or older may indicate a higher risk for a more serious condition. Depression can also present as weakness.',
                                ancillaryFind: [
                                    {
                                        type: 'lab',
                                        modifier: '\u2640 Pregnancy Test'
                                    }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['hyperventilation'],
                                text: 'Provide reassurance to the patient. Have the Soldier practice relaxed breathing. If symptoms do not resolve within 10 minutes, refer to AEM. If symptoms resolve, refer to behavioral health if available.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'respiratory rate greater than 14 per minute. Provide reassurance to the patient. Have the Soldier practice relaxed breathing. If symptoms do not resolve within 10 minutes, refer to AEM. If symptoms resolve, refer to behavioral health if available.',
                                    ancillaryFind: [{ type: 'refer', modifier: 'behavioral health' }]
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['viral syndrome'],
                                text: 'Viral syndrome can present as fatigue described as weakness. It is a global feeling often associated with other symptoms and muscle aches. Treat in accordance with related protocol.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Viral Syndrome: ibuprofen as needed for fatigue/body aches. Drink plenty of water. Get plenty of sleep.',
                                    medFind: [medList[23]],
                                    specLim: ['PT training at own pace/ rep/ distance x 3 days']
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['Insomnia', 'fatigue', 'stress', 'other sleep issue'],
                                text: 'Sleep issues can present as fatigue described as weakness. It can be a manifestation of depression or stress among other things. Provide education on sleep hygiene, consider providing diphenhydramine or melatonin nightly for three nights, consider activity modification, discuss stress management, and offer a routine referral to behavioral health asset for counseling and treatment',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'provide sleep hygiene education, recommend self-reflection to find a way to relieve stress, and offer a routine referral to a routine behavioral health asset, if available. Return to clinic if not improving, new symptoms arise, or symptoms are worsening',
                                    medFind: [medList[14]],
                                    ancillaryFind: [{
                                        type: 'refer', modifier: 'behavioral health'
                                    }],
                                    specLim: ['Allow for 8 hours of uninterrupted sleep in 24 hour period']
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "F-4",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Abnormal Vital Signs" },
                    { text: "Altered Mental Status" },
                    { text: "Focal Neurological Deficit" },
                    { text: "Recent Trauma" }
                ],
                answerOptions: []
            },
            {
                text: "Finger Stick Glucose",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Unable to touch chin to chest" },
                    { text: "Hypoglycemia" },
                    { text: "H/O Alcoholism" },
                    { text: "H/O narcotics" },
                    { text: "H/O seizures" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[0], modifier: 'Glucose < 70 - provide glucose. SpO2 <90 - start oxygen. H/O alcohol - give thiamine. H/O narcotics - give naloxone' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['shock', 'hypoglycemia', 'intracranial pathology', 'alcohol use', 'drug use', 'seizure'],
                                text: 'Abnormal vital signs may represent a more significant condition to include shock. Soldiers with an altered mental status should have their finger stick blood sugar checked. Hypoglycemia can cause an altered mental status. Focal neurological deficits and a recent trauma suggest intracranial pathology. Alcohol, narcotics, and other drugs can cause confusion through intoxication or withdrawal. Seizures can cause confusion even if the rhythmic jerking movements are not presenting in the Soldier.',
                                ancillaryFind: [
                                    { type: 'lab', modifier: 'finger stick glucose' },
                                    { type: 'lab', modifier: 'blood alcohol level' },
                                    { type: 'med', modifier: 'H/O alcohol - thiamine' },
                                    { type: 'med', modifier: 'H/O narcotics - naloxone' },
                                    { type: 'med', modifier: 'Glucose < 70 - glucose' },
                                    { type: 'protocol', modifier: 'SpO2 < 90 - oxygen' },
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: [3, 4],
                        selectAll: false
                    }
                ]
            },
            {
                text: 'draw the following labs',
                type: "action",
                questionOptions: [{ text: 'blood alcohol' }, { text: 'urine drug screen (UDS)' }],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Sudden onset" },
                    { text: "Heat exposure" },
                    { text: "Positive urine drug screen" },
                    { text: "Positive blood alcohol" },
                    { text: "Medication changes" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[1], modifier: 'Check rectal temp if heat exposure concern' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['heat injury', 'heat exhaustion', 'heat stroke', 'substance exposure', 'substance withdrawal'],
                                text: 'Sudden onset of symptoms is more concerning. Heat exhaustion, heat injury, and heat stroke can be associated with drowsiness or confusion. If a heat exposure is of concern, then a rectal temperature must be checked. Alternative methods of checking the temperature can be inaccurate. Alcohol, drug, or medication exposure or withdrawal can cause drowsiness. Some medications that can cause drowsiness include antihistamines, sleep medications, muscle relaxants, analgesics, and psychiatric medications.',
                                ancillaryFind: [{ type: 'protocol', modifier: 'rectal temp' }]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If drowsiness or confusion is not from a condition below, refer to AEM.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['viral syndrome'],
                                text: 'Viral syndrome can present as fatigue described as drowsiness. It is a global feeling often associated with other symptoms and muscle aches. Treat with ibuprofen as needed for fatigue/body aches. Treat other symptoms in accordance with the corresponding minor-care protocol.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'ibuprofen as needed for fatiguerbody aches. Drink plenty of water. Get plenty of sleep. Screen other symptoms as needed. Return to clinic if not improving, new symptoms arise, or symptoms are worsening',
                                    medFind: [medList[23]],
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['sleep problems'],
                                text: 'Sleep issues can present as fatigue described as weakness. It can be a manifestation of depression or stress among other things. Provide education on sleep hygiene, consider providing diphenhydramine or melatonin nightly for three nights, consider activity modification, discuss stress management, and offer a routine referral to behavioral health asset for counseling and treatment.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'provide sleep hygiene education, consider providing melatonin or activity modification, recommend self-reflection to find a way to relieve stress. and offer a routine referral to a behavioral health asset. if available. Return to clinic if not improving. new symptoms arise, or symptoms are worsening.',
                                    medFind: [medList[14]],
                                    ancillaryFind: [{ type: 'refer', modifier: 'behavioral health' }, { type: 'med', modifier: 'melatonin' }],
                                    specLim: ['Allow for 8 Hours of uninterrupted sleep in any given 24 hour period']
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "F-5",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Homicidal Intent or Attempt" },
                    { text: "Suicide Intent or Attempt" },
                    { text: "Self-injury" },
                    { text: "Altered Mental Status" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Positive suicide screening" },
                    { text: "Abnormal vital signs" },
                    { text: "Severe emotional distress" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[0], modifier: 'inform leadership. Do not leave Soldier alone. Remove means of self-harm' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “provider now.” These can be signs of significant underlying medical or serious behavioral health problems.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['suicidal ideation', 'homicidal ideation', 'depression', 'anxiety'],
                                text: 'Ask the following questions: In the past month, have you wished you were dead or wished you could go to sleep and not wake up? Have you had any thoughts about killing yourself? If YES to the second question, ask: Have you thought of how you might do this? Have you started to work out or have worked out the details of how to kill yourself? Do you have any intention of acting on these thoughts of killing yourself? Remain calm. Express concern and do not be dismissive. Do not be judgmental or argumentative. If YES to questions about suicidality, do not leave the Soldier alone. Remove means of self-harm. Do not leave the Soldier waiting alone for a long time in a busy waiting room, as this may increase the Soldier’s distress. Be aware that abnormal vital signs and/or anxiety or depression symptoms may represent an underlying medical issue'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Positive depression screening" },
                    { text: "Difficulty adjusting to injury or pain" },
                    { text: "Escorted due to safety concerns" },
                    { text: "Positive blood alcohol" },
                    { text: "Other indications of depression/anxiety" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[1], modifier: 'Obtain list of all medications and amount taken. Ask if currently receiving BH services' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['depression', 'anxiety', 'emotional distress', 'suicidal gesture'],
                                text: 'Ask the following questions for a depression screen: Over the past 2 weeks, have you often been bothered by feeling down, depressed, or hopeless? Over the past 2 weeks, have you often been bothered by having littler interest or pleasure in doing things? In addition to other situational, mental health, or medical causes, emotional distress may accompany injury and/or chronic pain and may merit a referral to behavioral health services. Ask Soldier how he or she is coping with the injury and/or pain. Other indicators of emotional distress may include disheveled appearance or poor hygiene, reported change in work performance, and risk-taking behavior. Obtain a list of all medications and the amounts taken to provide to the AEM. Taking significantly more of a medication than the prescribed amount may represent a suicidal gesture and should be inquired about if reported. If the Soldier was accompanied to the screening area by an escort, it may be due to high risk behavior or safety concerns. Inquire as to reason for escort, asking escort if necessary.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['mild mood symptoms'],
                                text: 'Soldiers that are experiencing mood symptoms that are mild in nature and not associated with other symptoms or impairment should be offered assistance. As always, remain calm, express concern for the Soldier, and do not be judgmental or argumentative. Educate the Soldier on the many resources that are available in your area, to include: Behavioral Health, Chaplaincy, Army Community Services, Chain of Command, Military and Family Life Consultants, Military OneSource, and Army Wellness Center. Offer to walk the Soldier to the resource that they prefer. Do not allow the Soldier to leave the screening area until they have been cleared by the supervising medic.',
                                specLim: ['Escort to Behavioral Health or Emergency Room if indicated']
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "F-6",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Deteriorating Level of Consciousness" },
                    { text: "Double Vision" },
                    { text: "Increased Restlessness, combative or agitated behavior" },
                    { text: "Repeat vomiting" },
                    { text: "Positive result from structural brain injury detection device (if available)" },
                    { text: "Seizure" },
                    { text: "Weakness or tingling in arms or legs" },
                    { text: "Severe or worsening headache" },
                    { text: "Abnormal Neuro Exam" },
                    { text: "Battle sign, Raccoon eyes" },
                    { text: "Suspected skull fracture" },
                    { text: "Anticoagulant use" }
                ],
                answerOptions: []
            },
            {
                text: "MACE 2 Exam",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Amnesia 30+ min before event" },
                    { text: "Neurological deficit" },
                    { text: "High impact head injury" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any red flag, immediately disposition the Soldier as “Provider Now” as these can be signs of medical emergencies.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['concussion'],
                                text: 'All Soldiers with a possible mTBI should be screened using the Military Acute Concussion Evaluation, version 2 (MACE 2) exam and results should be documented on the Soldier’s medical record. The MACE 2 assesses for red flags and the five predominate concussion sub-types (vestibular, oculomotor, headache/migraine, anxiety/mood, and cognitive). Presence of the following observable signs are suggestive of a concussion and prompt thorough evaluation: (1) lying motionless on the ground, (2) slow to get up after a direct or indirect blow to the head, (3) disorientation, confusion or inability to respond appropriately to questions, (4) blank or vacant look, (5) balance difficulties, stumbling, or slow labored movements, and (6) facial injury after head trauma. A positive initial screening on the MACE 2 indicates a concussive injury and often presents as alteration of consciousness (seeing stars, dazed, confused), loss of consciousness, or amnesia (trouble remembering the event). Positive screening with the following are recommended for a CT scan of the head: deteriorating level of consciousness, double vision, increased restlessness, combative or agitated behavior, severe or worsening headache, mental status (GCS<15), suspected skull fracture, sign of basilar skull fracture (hemotympanum, raccoon eyes, Battle sign, oto-/rhinorrhea), 2+ episodes of vomiting, amnesia for 30+ minutes before incident, neurologic deficit, seizure, severe incident (hit by motor vehicle, ejection from vehicle, fall >3 feet/ >5 stairs), or on an anticoagulant. The MACE 2 encompasses the following key areas: (1) concussion screening, (2) history questions (related to anxiety, migraine, and cervicogenic assessment), and (3) neurological, cognitive, and vestibular/oculomotor assessments. The neurological assessment includes speech fluency, word finding, single leg stance, tandem gait, pronator strength and eye tracking. The cognitive section includes scored evaluations of orientation and immediate and delayed recall. The vestibular/ocular-motor screening (VOMS) is a symptom-provoking exam that is necessary to detect patients at risk for delayed recovery due to oculomotor and vestibular deficits. Symptoms assessed are headache, dizziness, nausea, and fogginess.',
                                ancillaryFind: [{ type: 'protocol', modifier: 'MACE 2 exam' }]
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "MACE < 26" },
                    { text: "Nausea, dizziness" },
                    { text: "Headache" },
                    { text: "Memory, concentration problem" },
                    { text: "Balance/ visual problem" },
                    { text: "Ringing in the ears" },
                    { text: "Altered or loss of consciousness" },
                    { text: "H/O TBIs" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['concussion', 'mTBI'],
                                text: 'A MACE 2 cognitive score less than or equal to 25, any abnormality on the neurological exam, any abnormality on the VOMS exam, presence of one or more symptoms, observed loss or alteration of consciousness, or a history of TBIs require additional evaluation and treatment'
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['mTBI'],
                                text: 'MACE 2 screening that does not identify a concussion (screens negative) can be managed with reviewing the Acute Concussion Educational Brochure with Soldier, a mandatory 24 hour rest period followed by a re-evaluation after the 24 hour rest period prior to the Soldier returning to duty. Re-evaluation should include exertional testing if the Soldier is still asymptomatic. Exertional testing increases the cardiac output (blood pressure and heart rate) which can worsen symptoms by increasing swelling if present. Return to the clinic if symptoms worsen or new symptoms develop. More information is available at https://dvbic.dcoe.mil. Concussion treatment is guided by the results of the symptom cluster assessment generated by the MACE 2. A MACE 2 screening that identifies a concussion (screens positive) should prompt a minimum of 24-hour rest, with follow-up every 24 to 48 hours up to seven days. Additionally, concussions should be managed by initiation of the concussion management tool (CMT) and progressive return to activity (PRA) by a medical provider or other trained medical staff member. Results from the MACE 2 align to specific treatment protocols embedded within the CMT. Rapidly addressing vestibular and oculomotor deficits identified by the MACE 2 and daily evaluation of progress with the PRA will lead to faster recovery.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'All positive MACE 2 screens should be referred to the AEM or Provider for further evaluation. Negative MACE 2: 24 hour rest period, review Acute Concussion Educational Brochure with patient. and counsel Soldier to return after 24 hour rest for re-evaluation If no symptoms. perform exertional testing. Return to Clinic if worsening symptoms, new symptoms. More information is available at https://dvbic.dcoe.mil. See MACE 2 card, CMT, and PRA resources',
                                    specLim: ['Use the Concussion Management Tool (CMT) and associated Progressive Return to Activity (PRA) for specific management. A minimum of 24 hour rest, defined as:', '1. Rest with extremely limited cognitive activity', '2. Limit physical activities to those of daily living and extremely light leisure activity', '3. Avoid working, exercising, playing video games, studying, or driving', '4. Avoid any potentially concussive events', '5. Avoid caffeine and alcohol', 'Reassess using the MACE 2 after 24 hours rest']

                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "G-1",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Suicide Ideation" },
                    { text: "Homicide Ideation" },
                    { text: "Shortness of Breath" },
                    { text: "Stiff Neck" },
                    { text: "Melena" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Depression" },
                    { text: "Loss of libido" },
                    { text: "Weight change" },
                    { text: "Menorrhagia, Anemia > 3 weeks" },
                    { text: "Snoring" },
                    { text: "UPSTF" },
                    { text: "Screen/PHA out of date" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of medical emergencies.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['depression', 'adrenal or pituitary issue', 'hypo/hyperthyroidism', 'anemia', 'sleep apnea'],
                                text: 'While fatigue is often not caused by a specific disease, it may be a presenting symptom of a potentially serious condition. Depression may only present as fatigue. Decreased libido could be a sign of an adrenal/pituitary issue. Weight change could represent hypo/hyperthyroidism. Menorrhagia often results in anemia. Snoring can be a sign of sleep apnea. USPSTF Screening/PHA is to look at age appropriate cancer and cardiovascular screening. Infections, inflammation, liver/kidney disease, and medication/drug use can also cause fatigue.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Cold, Sore throat Sx" },
                    { text: "Rectal bleeding" },
                    { text: "Other symptoms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Screen bleeding, cold, sore throat, other symptoms if present"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier has other specific complaints or symptoms, the Soldier should be evaluated for that complaint. Otherwise, the minor-care protocol is appropriate.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['fatigue'],
                                text: 'Advise the Soldier that vitamins are rarely helpful, that “pep pills” do not work (the rebound usually makes the problem worse), and that tranquilizers generally intensify fatigue. Taking a vacation, if possible, or undertaking new activities are often helpful. Helpful Actions Include: Identifying potential sources of the fatigue such as work stress, marital discord, lack of rest or sleep (either quantity or quality of sleep), or a poor/not well balanced diet. Provide information on proper sleep hygiene and refer to sleep hygiene course if locally available. If not a suicidal risk (which would require immediate referral) suggest various available options for counseling, including behavioral health, Army community services, and the chaplain. Work on the problem rather than on the symptom. Seek medical assistance if symptoms worsen, other symptoms develop, fatigue makes normal activities difficult, difficulty staying awake while driving, or not improved within one week.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['sleep problem'],
                                text: 'Sleep issues can present as fatigue described as weakness. It can be a manifestation of depression or stress among other things. Provide education on sleep hygiene, consider providing diphenhydramine or melatonin nightly for three nights, consider activity modification, discuss stress management, and offer a routine referral to behavioral health asset for counseling and treatment.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: '',
                                    medFind: [medList[14]],
                                    ancillaryFind: [{ type: 'med', modifier: 'melatonin' }, { type: 'refer', modifier: 'behavioral health' }],
                                    specLim: ['Allow for 8 hours of uninterrupted sleep with a 24 hour period']
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "G-2",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Heat Injury" },
                    { text: "Stiff Neck" },
                    { text: "Light sensitivity" },
                    { text: "Pregnant" },
                    { text: "Seizure" },
                    { text: "Lightheaded" }
                ],
                answerOptions: []
            },
            {
                text: "Red flags?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of medical emergencies.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Abnormal Vitals" },
                    { text: "HIV positive" },
                    { text: "Immunosuppression" },
                    { text: "Overseas travel within 6 months" },
                    { text: "Tick, mosquito bite" },
                    { text: "Malaria area" },
                    { text: "Animal exposure" },
                    { text: "IV drug use" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['HIV', 'bacterial infection', 'zoonotic infection', 'malaria', 'endocarditis'],
                                text: 'If the Soldier’s temperature is greater than 100.4°F, has symptoms for more than 48 hours, HIV infection, or immunosuppression, then there is a greater risk of the fever being caused by a bacterial infection. Overseas travel, tick or mosquito bite, animal exposure, and malaria endemic area, increase the risk of a zoonotic or malaria infection. IV drug use increases the risk of endocarditis.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Cold, Sore throat Sx" },
                    { text: "Ear pain" },
                    { text: "Diarrhea" },
                    { text: "Pain with urination" },
                    { text: "Other symptoms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Screen other symptoms algorithm"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Before assuming the Soldier has isolated fever/chills, be sure to ask him/her specifically about other symptoms such as upper respiratory infection symptoms, cough, sore throat, ear pain, diarrhea, dysuria, rash, and muscle aches. If no associated symptoms can be identified, over half of Soldiers’ fever will resolve on its own without an underlying issue being identified.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Instruct the Soldier to stay well hydrated and get plenty of rest. He or she should drink fluids to keep their urine mostly clear and obtain at least eight hours of rest per day. Take acetaminophen as needed for temperature above 98.4°F (No more than eight tablets within 24 hours. No other medications with acetaminophen in them. No alcohol.) Soldier is contagious while he or she has an elevated temperature. He or she should avoid contact with healthy Soldiers as much as possible. If in training, refer to local SOP. Soldier may need to be placed in quarters. Return for medical assistance if symptoms do not improve with acetaminophen, other symptoms develop, or a fever develops (T > 100.4).',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'OTC Medication: acetaminophen as needed for elevated temperature (No other medications with acetaminophen. No alcohol.), ibuprofen as needed for malaise. Stay hydrated by drinking fluids to keep your urine mostly clear. Get plenty of rest. Return if red flags, new symptoms. lasts longer than 48 hours, or fever not controlled with acetaminophen',
                                    medFind: [medList[0], medList[23]],
                                    specLim: ['For a Fever: Consider Quarters x 24-48 hours (must discuss with supervising privileged provider)']
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "H-1",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Fixed, Abnormal Pupil" },
                    { text: "Visual Acuity Change" },
                    { text: "Observed Foreign Body" },
                    { text: "Penetration, Rupture" },
                    { text: "Chemical Exposure" },
                    { text: "Fluid Level over Iris, Pupil" }
                ],
                answerOptions: []
            },
            {
                text: "Eye exam / Fluorescein. *Do not perform fluorescein exam if there is concern for an open globe or ruptured eye*",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red Flags" },
                    { text: "Fluorescein uptake" },
                    { text: "Immunosuppression" },
                    { text: "Recent eye surgery" },
                    { text: "Associated head trauma" },
                    { text: "Double vision" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of medical emergencies.'
                            },
                            {
                                type: 'dmp',
                                ddx: [],
                                text: 'Perform an eye exam with visual acuity. Do not perform a fluorescein exam if concerned for an open globe. Cover the eye with an unpadded protective fox shield or cup and discuss with the supervising privileged provider if a potential foreign body. A privileged provider order is required to irrigate the eye except when immediate irrigation is required for a chemical exposure. A white or red layered fluid level over the iris is a sign of a hypopyon or hyphema, respectively, requiring emergent referral. Contact lens, recent eye surgery, and fluorescein uptake increase potential of a serious condition.',
                                ancillaryFind: [
                                    { type: 'protocol', modifier: 'visual acuity' },
                                    { type: 'protocol', modifier: 'fluorescein exam' },
                                ]
                            }
                        ],
                        disposition: [{ ...Disposition[0], modifier: 'chemical - irrigation. foreign body - fox shield. head trauma - stabilize neck. other - cover eye' }],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Thick, yellow or green discharge" },
                    { text: "Painful" },
                    { text: "Light sensitivity" },
                    { text: "Inability to keep eye open" },
                    { text: "Trauma" },
                    { text: "History foreign body getting better" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['bacterial conjunctivitis', 'foreign body', 'inflammatory process'],
                                text: 'Thick, yellow or green discharge that continues throughout the day suggests bacterial conjunctivitis. Eye pain, light sensitivity, inability to open or keep the eye open, and foreign body sensation suggests a corneal or intraocular inflammatory process. Fast moving metal or glass slivers from an explosion or welding can penetrate the eye with symptoms that rapidly disappear. A history of a foreign body that is now “getting better” should be screened as a foreign body.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'mcp',
                                ddx: ['hordeolum (stye)'],
                                text: 'warm compress x 16 min, 4x day followed by massaging area.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['blepharitis'],
                                text: 'blepharitis (crusting of the eye in the morning with or without red, swollen eyelids): treatment is washing of the eyelashes daily with washcloth using warm water and non-tearing baby shampoo, warm compresses, lid massage. Instruct to avoid lotions, creams, make-up to the affected area. RTC if worsening or not improving within one week.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'warm compress (like stye), avoidance of make-up, and washing with warm water and tear free shampoo.'
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['dry eyes'],
                                text: '(tearing, blurry vision that clears with blinking, and a gritty sensation): treatment is artificial tears prn.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'artificial tears lubricating drops as needed'
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['viral conjunctivitis', 'allergic conjunctivitis'],
                                text: '(crusting, watery discharge with burning (viral) or itching (allergic)): viral is highly contagious. Treatment is with warm or cool compresses and topical antihistamine/decongestant drops.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'warm or cool compresses, topical antihistamine/decongestant drops, and contagion precautions'
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['subconjunctival hemorrhage'],
                                text: 'further evaluation is necessary when associated with trauma, is recurrent, or Soldier is on an anticoagulant',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'subconjunctival hemorrhage is a demarcated area of blood (outside of the iris) with normal vision, no discharge, light sensitivity, or foreign body sensation. Typically resolves in 1-2 weeks'
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "H-2",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Open Globe" },
                    { text: "High Risk Laceration" },
                    { text: "Decreased Visual Acuity" },
                    { text: "Double Vision" }
                ],
                answerOptions: []
            },
            {
                text: "Eye exam visual",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red Flags" },
                    { text: "Fixed pupil" },
                    { text: "Mod-severe pain" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[0], modifier: 'fox shield/protectove cover. head trauma - stabilize neck' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of medical emergencies.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['open globe fracture', 'laceration', 'orbital compartment syndrome'],
                                text: 'Assess for life-threatening injuries (head, neck, and airway) before performing an eye exam with visual acuity. Access for signs of an open globe. Laceration of full thickness of eyelid, with orbital fat prolapse, through lid margin, involving lateral/medial/tear duct/or muscles, or associate with avulsion or malalignment requires referral. Decreased visual acuity and double vision along with pain, fixed pupil, and swelling around the eye are signs of a potential internal eye injury. Orbital compartment syndrome can develop which is a medical emergency requiring immediate treatment.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Significant redness, swelling" },
                    { text: "Rash > 1 week" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['cellulitis', 'dermatitis'],
                                text: 'Significant redness and swelling can be signs of cellulitis. Cellulitis is a relatively common complication of a stye. It requires further evaluation and treatment with oral antibiotics. Dermatitis and some systemic diseases can also present with an eyelid rash requiring further evaluation and treatment.'
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['stye (hordeolum)'],
                                text: 'presents with redness, tenderness, and swelling of the eyelid. Initial treatment should be a warm compress placed on the area for 15 minutes four times per day with massage of the area after the warm compress. Return to clinic if becomes significantly painful, redness and swelling spreads, or not improving within one week.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'warm compress x 14min, 4x/day followed by massing area. RTC to clinic if the condition is worsening, new symptoms develop, or it is not improving within 1 week'
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['chalazion'],
                                text: 'presents with painless swelling of the eyelid. It is treated the same way as a stye and usually resolves within a couple of weeks.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'warm compress x 14min, 4x/day followed by massing area. RTC to clinic if the condition is worsening, new symptoms develop, or it is not improving within 1 week'
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['blepharitis'],
                                text: 'presents with bilateral crusting of the eye in the morning and may be associated with red, swollen eyelids, and dry eyes that improve with blinking. Treatment is washing of the eyelashes daily with washcloth using warm water and non-tearing baby shampoo, warm compresses, lid massage. Instruct to avoid lotions, creams, make-up to the affected area. RTC if worsening or not improving within one week.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'warm compress (like stye), avoidance of make-up, and washing with warm water and tear free shampoo. RTC to clinic if the condition is worsening, new symptoms develop, or it is not improving within 1 week'
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['contact dermatitis'],
                                text: 'skin reaction from an irritant. In a female, make-up is the most common cause. Evaluate for any new exposures, other areas involved. Instruct to avoid the most likely contact/cause and any lotions, creams, or soaps with perfumes, hair dyes, new shampoos, and eye make-up. Use hydrocortisone cream with precautions to avoid getting it in the eye.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'avoidance of the exposure and hydrocortisone ointment 1% twice a day for 1 week',
                                    medFind: [medList[21]]
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "H-3",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Trauma" },
                    { text: "Recent Surgery" },
                    { text: "Chemical Exposure" },
                    { text: "Fluid Level over Iris, Pupil" },
                    { text: "Neurologic Deficits" }
                ],
                answerOptions: []
            },
            {
                text: "Eye exam",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red Flags" },
                    { text: "Observed foreign body" },
                    { text: "Partial visual field affected" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of medical emergencies.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['retinal detachment', 'foreign body', 'hypopyon', 'hyphema'],
                                text: 'Perform an eye exam with visual acuity. Decreased visual acuity following trauma may indicate a serious injury that requires immediate treatment. Retinal detachment is often preceded by flashes of light, new floaters, and black spots, these symptoms should prompt an ASAP dilated retinal exam by an eye care provider. A foreign body seen on exam should not be removed. Cover the eye with a protective fox shield or cup and discuss with the supervising privileged provider. A privileged provider order is necessary prior to irrigation of a foreign body except when immediate irrigation is required for a chemical exposure. A white or red layered fluid level over the iris is a sign of a hypopyon or hyphema, respectively, and requires emergent referral. If the decreased vision involves a distinct part of the visual field which includes a black spot that moves with your eye, the cause may be serious.',
                                ancillaryFind: [{ type: 'protocol', modifier: 'visual acuity' }]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "contact wearer" },
                    { text: "Onset within 7 days" },
                    { text: "Painful" },
                    { text: "Red" },
                    { text: "Headache" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['keratitis', 'corneal abrasion', 'migraine'],
                                text: 'Wearing contacts increases the risk of keratitis and corneal abrasion. Fluorescein exam is the next step to evaluate for these causes. Visual acuity of contact wearer should be performed with and without glasses to evaluate for a change in vision not related to the contacts. Acute onset and pain are signs of a more concerning cause than the need for glasses. Migraine can be associated with temporary decreased vision or seeing spots prior to a headache (an aura).',
                                ancillaryFind: [
                                    { type: 'protocol', modifier: 'visual acuity' },
                                    { type: 'protocol', modifier: 'fluorescein exam' },
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['decreased visual acuity', 'retinal detachment'],
                                text: 'visual acuity worse than 20/40 requires a referral to optometry for evaluation for glasses. Worsening of the vision is gradual and often occurs in both eyes. Noticing the issue may occur with a specific activity like trying to read a sign, seeing a target at the range, or Soldier may present requesting an evaluation or been screened during a yearly readiness screening. (Note: protective mask inserts are not usually provided to personnel with uncorrected vision of 20/40 or better). Floaters are clumps of material in the gel-like substance in the back of your eye. They are common, usually benign and move around in your field of vision. They are not fixed to a particular location in the field of view or significantly obstruct the field of view. However, new floaters may be a sign of retinal detachment.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'decreased visual acuity worse than 20/40: gradual onset refer to optometry for evaluation for glasses. floaters are common and usually benign. However, new floaters may be a sign of retinal detachment and warrant immediate referral to supervising medical provider. Return to clinic if the condition is worsening or new symptoms develop',
                                    ancillaryFind: [
                                        { type: 'refer', modifier: 'optometry if VA < 20/40 gradual onset' }
                                    ]
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "H-4",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Trauma" },
                    { text: "Neurologic Deficits" }
                ],
                answerOptions: []
            },
            {
                text: "Visual Acuity",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red Flags" },
                    { text: "Red Eye" },
                    { text: "Associated pain" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[0], modifier: 'head trauma - stabilize neck' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of medical emergencies.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['head/brain injury'],
                                text: 'Assess for potential life-threatening injuries (head, neck, and airway) before accessing for vision issues. If the double vision is related to a recent trauma to the head, neck, or back, then it may represent a serious injury to the brain. Neurologic deficits (trouble walking, talking) can indicate a serious problem requiring immediate evaluation.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Appears intoxicated" },
                    { text: "With 1 eye shut" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Cover one of the patient’s eyes and then the other, assessing whether the double vision persists or not. If double vision continues despite having one eye shut or if double vision is a new issue, the Soldier will need to be referred to an eye care provider (ophthalmologist or optometrist).'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [{ ...Disposition[3], modifier: 'optometry' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['diplopia'],
                                text: 'long-standing history of double vision or double vision caused by new eyeglasses may well indicate a need for evaluation of the eyeglass prescription. The Soldier should be given an appointment at the optometry clinic. Soldier should not drive a vehicle, fire a weapon, or perform other duties requiring depth perception',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Long-standing history or started with new eyeglasses, refer to optometry and patch the eye for symptomatic relief. No driving a vehicle, firing a weapon, or other duties requiring depth perception until the Soldier has been evaluated by an optometrist. Return to clinic if symptoms worsen or new symptoms develop.',
                                    ancillaryFind: [{ type: 'refer', modifier: 'optometrist' }],
                                    specLim: ['no driving', 'no firing weapon', 'no duties requiring depth perception']
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "I-1",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Skin Changes" },
                    { text: "Mass" },
                    { text: "Bloody Nipple Discharge" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red Flags" },
                    { text: "T> 100.4" },
                    { text: "Red, swollen breast" },
                    { text: "Focal breast pain but no other symptoms" },
                    { text: "Family H/O early breast cancer" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',

                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be an indication of significant underlying medical problems.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['mastitis', 'abscess', 'cancer'],
                                text: 'Skin changes, mass, or bloody nipple discharge are concerning symptoms that require further evaluation and imaging. Red, swollen breast can represent mastitis or an abscess that requires further evaluation and treatment.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Male with H/O testosterone supplement" },
                    { text: "Female breastfeeding" },
                    { text: "Repeat visit" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['gynecomastia', 'infection', 'mastalgia'],
                                text: 'Testosterone supplementation in exercise supplements can result in enlargement of breast tissue under the nipple. Enlarged breast tissue can be painful, especially when wearing body armor, further evaluation and counseling are warranted. Nursing mothers often have problems with cracked or infected nipples or have difficulty when the child is weaned, but further examination is required to rule out more concerning issues. Pain without other concerns that is not related to breastfeeding weaning, exercise, or cyclical pain with menstrual cycle requires further evaluation and may require imaging.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['breast pain', 'large breasts'],
                                text: 'women with a large amount of breast tissue can have discomfort associated with stretching of Cooper’s ligaments. It can be associated with shoulder, back, or neck pain and made worse with exercise. Educate the Soldier on the importance of supportive undergarments, ice compress/heat compress for inflammation, acetaminophen as needed for mild pain, and ibuprofen (1st line) or ketorolac (2nd line) as needed for moderate pain.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'educate the patient on importance of physical support (well-fitting bra). Ice/heat (1st line) or acetaminophen (2nd line) as needed for mild pain. Ibuprofen (1st line) or ketorolac (2nd line) as needed for moderate pain',
                                    medFind: [medList[0], medList[23], medList[24]]
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['chest extramammary/musculoskeletal pain'],
                                text: 'related to the chest wall and not the breast tissue. Ice/heat compresses as needed for inflammation. Medication: mentyl salicylate (1st line) or acetaminophen (2nd line) as needed for mild pain, and ibuprofen (1st line) or ketorolac (2nd line) as needed for moderate pain. Activity modifications should be considered as appropriate. RTC if no improving within 3 days, worsening symptoms, or development of new symptoms',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'ice/hear for inflammation, menthyl salicylate (1st line) or acetaminophen (2nd line) as needed for mild pain, ibuprofen (1st line) or ketorolac (2nd line) as needed for moderate pain. Activity modifications as needed. RTC if no improving within 3 days, worsening symptoms, or development of new symptoms',
                                    medFind: [medList[28], medList[0], medList[23], medList[24]],
                                    specLim: ['no running, jumping, rucking', 'walk at own pace/distance', 'may lift, carry, push up to 25 lbs.']
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['diffuse breast pain'],
                                text: 'diffuse breast pain is unlikely to be related to cancer. Provide reassurance. If the Soldier is concerned about the possibility of breast cancer after reassurance, refer to provider for consideration of an imaging study to provide reassurance. Treat discomfort with ice/heat (1st line) or acetaminophen (2nd line) as needed for mild pain and ibuprofen (1st line) or ketorolac (2nd line) as needed for moderate pain.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'ice/heat for inflammation, menthyl salicylate (1st line) or acetaminophen (2nd line) as needed for mild pain, ibuprofen (1st line) or ketorolac (2nd line) as needed for moderate pain. Provide reassurance. Refer to provider if Soldier is concerned about risk of breast cancer after reassurance. RTC if no improving within 3 days, worsening symptoms, or development of new symptoms',
                                    medFind: [medList[28], medList[0], medList[23], medList[24]],
                                }
                            }
                        ],
                        disposition: [Disposition[2]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "I-2",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Positive hCG AND" },
                    { text: "Pelvic Pain" },
                    { text: "H/O Ectopic Pregnancy" },
                    { text: "Vaginal Bleeding" }
                ],
                answerOptions: []
            },
            {
                text: "Draw the following labs",
                type: "action",
                questionOptions: [{ text: 'hCG' }],
                answerOptions: []
            },
            {
                text: "Red Flags?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” They can be signs of significant underlying medical problems.',
                            },
                            {
                                type: 'dmp',
                                ddx: ['ectopic pregnancy', 'miscarriage'],
                                text: 'Check a urine hCG. If the urine hCG is negative, confirm negative with a serum hCG. Positive hCG with pelvic pain or history of a prior ectopic pregnancy increases the possibility of an ectopic pregnancy. Vaginal bleeding suggests a possible miscarriage or complication of pregnancy.',
                                ancillaryFind: [
                                    { type: 'lab', modifier: 'urine hCG' },
                                    { type: 'lab', modifier: 'serum hCG' },
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Positive HCG without other symptoms?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['pregnancy'],
                                text: 'Refer Soldiers with a positive pregnancy test to the AEM. The Soldier will need to receive initial pregnancy counseling that includes medications and foods to avoid, importance of a daily prenatal vitamin, avoidance of alcohol, pregnancy profile, and referral to obstetrics-gynecology clinic. These services are also sometimes provided by the clinic nurse depending on local protocol.',
                                // required by DHA for initial pregnancy. I have to double check my favorite orders in Genesis to make sure I get all of them.
                                ancillaryFind: [
                                    { type: 'protocol', modifier: 'initial pregnancy counseling' },
                                    { type: 'refer', modifier: 'OB/GYN' },
                                    { type: 'med', modifier: 'prenatal vitamin / Folate' },
                                    { type: 'lab', modifier: 'TSH' },
                                    { type: 'lab', modifier: 'HIV' },
                                    { type: 'lab', modifier: 'TSH' },
                                    { type: 'lab', modifier: 'TSH' },
                                    { type: 'lab', modifier: 'TSH' },
                                    { type: 'rad', modifier: '1TM US' },

                                ],
                                specLim: ['pregnancy profile']
                            }
                        ],
                        next: null,
                        selectAll: false
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['taking contraception', 'increased exercise / stress'],
                                text: 'there are multiple causes of a late cycle that are unrelated to pregnancy to include birth control medications, increasing exercise regimen, and stress. Average menstrual cycle is 28 days but can range from 24 to 38 days. Instruct the Soldier to avoid alcohol and NSAID medications (to include Ibuprofen, naproxen, or ketorolac). Return to the clinic in one week if she still has not had a cycle.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Counsel the Soldier to avoid alcohol and NSAID medications. Return to clinic in 1 week if she still has not had a cycle.'
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "I-3",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Sexual Assault" },
                    { text: "Trauma" },
                    { text: "Severe Pain" },
                    { text: "Pregnant" }
                ],
                answerOptions: []
            },
            {
                text: "Draw the following lab",
                type: "action",
                questionOptions: [{ text: 'urine hCG' }],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Non-midline pelvic pain" },
                    { text: "Pain with intercourse" },
                    { text: "Post menopause" },
                    { text: "Bleeding > 10 days not on birth control" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['sexual assault', 'miscarriage', 'pelvic inflammatory disease', 'malignancy'],
                                text: 'If due to Sexual Assault, immediately notify the supervising privileged provider. Do not leave the victim alone. Ask if she would prefer a female medic/privileged provider if one is available. If bleeding is over one week late or the previous bleeding was spotting, it could represent a pregnancy. Bleeding during pregnancy (positive hCG) can represent a miscarriage or complication of pregnancy and needs to be seen ASAP. Non-midline pelvic pain and pain with intercourse are signs of pelvic inflammatory disease. Bleeding after menopause (vaginal bleeding in a 45 y/o or older woman who had no menstrual cycles for 12 months) needs to be evaluated for possible malignancy. Heavy vaginal bleeding (vaginal bleeding enough to soak through one (1) or more tampons or sanitary pads per hour) requires immediate referral to supervising medical provider.',
                                ancillaryFind: [
                                    { type: 'protocol', modifier: 'notify provider immediately for sexual assault. Do not leave patient alone' },
                                    { type: 'lab', modifier: 'urine hCG' },
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: [3, 4],
                        selectAll: false
                    }
                ]
            },
            {
                text: "Obtain the following information",
                type: "action",
                questionOptions: [{ text: 'Menses History: Length, Severity (clots, #pads), Medications' }],
                answerOptions: []
            },
            {
                text: "Positive hCG without other symptoms?",
                type: "choice",
                questionOptions: [
                    { text: "New problem" },
                    { text: "Failed previous self-care" },
                    { text: "Menstrual pain onset after 25 y/o" },
                    { text: "Progression of symptoms" },
                    { text: "Menses < 21 or > 35 days" },
                    { text: "Spotting >1 pad/2hrs" },
                    { text: "Prevents normal duties" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['adenomyosis', 'endometriosis', 'fibroids', 'taking contraception'],
                                text: 'Most common problems are irregular and painful periods. Menstrual pain starting after age 25, progressive worsening of symptoms, and poor relief with Ibuprofen are symptoms of a secondary cause to include adenomyosis, endometriosis, or fibroids. Spotting (light vaginal bleeding that occurs outside of a woman’s usual menstrual cycle) on Depo-Provera, Nexplanon, or intrauterine device (IUD) is not uncommon but should be examined further. Menses lasting for over five days, more often than every 21 days or less often than 35 days, or bleeding in between menses is considered abnormal. Soaking a pad or tampon more often than every hour or interferes with daily activities is considered heavy.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['dysmenorrhea'],
                                text: 'bothersome menstrual cramping (dysmenorrhea) usually lasts about 24 hours. It may be relieved by naproxen or ibuprofen for five to seven days. Ketorolac can be used on presentation for moderate pain. Seldom is discomfort such that the Soldier is unable to perform normal activities. Give the Soldier symptomatic medication and instructions for use. Instruct the Soldier to return if the symptoms are worsening, new symptoms develop, or the minor-care protocol is not controlling the symptoms such that the problem is preventing performance of normal duties. A privileged provider can evaluate further and may prescribe additional medications to help decrease the symptoms during future menstrual cycles.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'provide NSAID like naproxen or ibuprofen as needed for pain to be taken with food for up to 7 days. Ketorolac as a 1 x dose for moderate pain. A warm compress may also be placed over the abdomen to help with the discomfort. RTC if symptoms are worsening, new symptoms developing, or symptoms are not controlled with the MCP',
                                    medFind: [medList[23], medList[30]],
                                    specLim: ['aerobic exercise at own pace/distance x 3 days', 'must have access to restroom every hour']
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "I-4",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Fever" },
                    { text: "Pregnant" },
                    { text: "Non-midline Pelvic Pain" },
                    { text: "Pain with Intercourse" }
                ],
                answerOptions: []
            },
            {
                text: "Draw the following labs",
                type: "action",
                questionOptions: [{ text: 'urine hCG' }],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Recurrent vaginitis" },
                    { text: "Presence of IUD" },
                    { text: "Vaginal discharge" },
                    { text: "Genital lesion, ulcer" },
                    { text: "Vaginal lump, mass" },
                    { text: "Pelvic pain during exercise" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['pelvic inflammatory disease', 'vaginal infection', 'recurrent infection'],
                                text: 'Fever, non-midline pelvic pain, and pain with intercourse are symptoms of pelvic inflammatory disease, which is a serious infection requiring further evaluation. Vaginal infections and certain medications have a higher risk during pregnancy. Recurrent infections or infections that failed initial therapy require treatment regimens and closer observation. Vaginal discharge, lesion, or ulcer requires an invasive physical exam with laboratory evaluation. If facilities for a speculum physical exam and/or microscopic evaluation are not available and evacuation is not feasible, then treat according to history in minor-care protocol section.',
                                ancillaryFind: [
                                    { type: 'protocol', modifier: 'speculum exam *credentialed provider only*' },
                                    { type: 'lab', modifier: 'microscopic laboratory evaluation' }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Moderate vaginal pain" },
                    { text: "Presentation different from the treatment protocol descriptions" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['vaginitis'],
                                text: 'Vaginitis may have an atypical presentation. In these situations, a more detailed evaluation is required.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'When facilities for a speculum exam and/or microscopic evaluation are not available and evacuation is unfeasible, the Soldier may be treated according to the history below.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['yeast infection (candidiasis)'],
                                text: 'presents with a scant amount of thick, white (cottage cheese like) discharge that is usually odorless and may be associated with vulvar itching, soreness, and dysuria. Symptoms are often worse the week before a menstrual cycle. Vaginal pH is typically normal (pH of 4-4.5). Treat with fluconazole',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'treat with fluconazole. RTC if symptoms are worsening, new symptoms developing, or MCP does not resolve the symptoms'
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['bacterial vaginosis'],
                                text: 'presents with a thin, greyish discharge, vaginal pH greater than 4.5, and a fishy smell (prominent when 10% potassium chloride is added to a slide of vaginal discharge) without signs of inflammation. Symptoms are often pronounced during menstrual cycle or after intercourse. Treat with metronidazole for seven days. Instruct the Soldier to return if the symptoms are worsening, new symptoms develop, or the minor-care protocol does not resolve the symptoms',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'treat with metronidazole for 7 days. RTC if symptoms are worsening, new symptoms developing, or MCP does not resolve the symptoms',
                                    medFind: [medList[29]]
                                }
                            }
                        ],
                        disposition: [Disposition[2]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "I-5",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Draw the following lab",
                type: "action",
                questionOptions: [{ text: 'urine hCG' }],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Pregnant" },
                    { text: "Abnormal previous pap" },
                    { text: "Total hysterectomy" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier’s menstrual cycle is late, check a pregnancy test. If the Soldier is pregnant, refer to the AEM. Look in lab results for previous pap smears. If there has been an abnormal pap lab result, look for the clinical note that details the plan of care. If a plan of care is not found or last pap smear sample was inappropriate, refer to supervising medical provider. Determine if the plan was followed and discuss with the AEM to determine care.',
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "1st pap over 21 y/o" },
                    { text: "21-29 y/o pap/3 yrs" },
                    { text: "30+ y/o pap/3 yrs or pap and HPV/5 yrs if tests are negative" },
                    { text: "Additional screening: HPV vaccine and G/C screening" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: 'Confirm the current USPSTF standards. Initial Pap smear should be performed starting at 21 years old. From ages 21-29 years old, Pap smear should be performed every three years. From age 30 and older, Pap smear can be performed every three years or Pap smear and HPV testing every five years if both tests are negative. HPV vaccine is recommended up to age 26. G/C screening is recommended yearly for women less than 26 y/o.'
                            }
                        ],
                        disposition: [{ ...Disposition[4], text: 'Schedule Appointment' }],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: 'Confirm the current USPSTF standards. Initial Pap smear should be performed starting at 21 years old. From ages 21-29 years old, Pap smear should be performed every three years. From age 30 and older, Pap smear can be performed every three years or Pap smear and HPV testing every five years if both tests are negative. HPV vaccine is recommended up to age 26. G/C screening is recommended yearly for women less than 26 y/o.'
                            }
                        ],
                        disposition: [{ ...Disposition[4], text: 'Schedule Appointment' }],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "I-6",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Draw the following lab",
                type: "action",
                questionOptions: [{ text: 'urine hCG' }],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Pregnant" },
                    { text: "Medication side-effects" },
                    { text: "H/O recent unprotected sex" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['pregnant', 'side effects of current contraceptive'],
                                text: 'Determine date of last menstrual cycle. Check a pregnancy test if the Soldier’s menstrual cycle is late. Determine history of previous contraceptive use. If the Soldier is having side-effects from her current birth control or has had recent unprotected sex, refer for further evaluation.',
                                ancillaryFind: [{ type: 'lab', modifier: 'urine hCG' }]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Discuss effectiveness of each type of contraceptive" },
                    { text: "Discuss contraceptive preferences" },
                    { text: "Discuss additional benefits" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[4], text: 'Schedule appointment or referral' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: 'Long acting contraceptives are the most effective (surgical/permanent, IUD, implantable). Injectable, oral, patch, vaginal ring effectiveness is partially based on consistent, correct use. Condoms and behavioral modification are least effective. Choose the most effective method that the Soldier will be able to use successfully. If male, discuss the permanent nature of the vasectomy procedure (*Refer to L-5, Requests a Vasectomy), discuss with AEM, and follow local protocol for referral. Discuss potential side effects of hormonal contraceptives. Estrogen-progesterone decrease menstrual symptoms, acne, and hirsutism. Progesterone and IUDs decrease menstrual symptoms. Longer term contraception to include injectable types have a risk of irregular bleeding, spotting. Discuss Soldier preferences and history with AEM. Check hCG if requesting medroxprogesterone acetate intramuscular injection. Schedule appointment with supervising privileged provider for a more thorough discussion of contraceptive options and discussion of potential side effects. Schedule accordingly: routine appointment (injectable, oral, patch, ring) or procedural appointment or referral based on supervising privileged provider preferences (implantable, IUD).',
                                ancillaryFind: [
                                    { type: 'protocol', modifier: 'discuss contraceptive options' }
                                ]
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [{ ...Disposition[4], text: 'Schedule appointment or referral' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-1",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Airway Compromise/Swelling" }
                ],
                answerOptions: []
            },
            {
                text: "Red Flags?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.'
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "New medication" },
                    { text: "Fever" },
                    { text: "Painful (not a sunburn)" },
                    { text: "Failed previous treatment or worsening" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['drug eruption'],
                                text: 'Skin rash associated with a medication, fever, or is painful (but not due to a sunburn) has the potential to be very serious. Further evaluation is indicated when it has failed previous treatment or is worsening. Certain anatomical locations present with a higher risk of complications to include the face, genitals area, or inhibiting a joint function.',
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Change in color" },
                    { text: "Oozing blood or fluid" },
                    { text: "Present > 4 weeks" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Change in a lesion or oozing of fluids require further evaluation. Skin lesions that have been present for over four weeks may represent a symptom of a systemic condition.'
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier is already on a treatment for this issue, has not finished the current treatment, and the issues is not getting worse, then instruct the Soldier to continue with the current treatment for the full course. Some skin issues can take two to three weeks or potentially longer for them to work. Confirm with your supervising NCO or supervising privileged provider before returning the Soldier to work. If you recognize the skin lesion, then screen according to the identified skin condition. If you do not recognize the skin lesion, refer the Soldier to the AEM for further evaluation.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Continue the current skin treatment regimen if it has not been completed/followed for the necessary amount of time (usually 2-3 weeks). Screen according to pertinent algorithm if you can identify the skin contision. Refer to AEM for further evaluation if you cannot identify the skin condition '
                                }
                            }
                        ],
                        disposition: [Disposition[2]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-2",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Check hCG",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Requesting birth control" },
                    { text: "Positive hCG" },
                    { text: "Draining lesion" },
                    { text: "Acute onset" },
                    { text: "Requiring limitations in protective equipment" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Birth control and a positive hCG requires additional counseling that should be provided by the supervising privileged provider. Hyperandrogenism requires additional evaluation. Draining lesions requires more aggressive therapy. Acute onset of acne symptoms for the first time after age 18 requires further evaluation'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Acne interferes with wearing equipment" },
                    { text: "Moderate to severe inflammatory acne" },
                    { text: "Scarring or hyperpigmentation" },
                    { text: "Failed initial treatment" },
                    { text: "Appears very self conscious" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Moderate to severe acne or acne on the back or interferes with wearing equipment requires evaluation for oral medications and temporary profile. Scarring and hyperpigmentation requires more aggressive therapy to avoid further permanent scarring. There can be psychological effects from acne. It is important to identify Soldiers that are very self-conscious and escalating the treatment regimen to quickly control the acne.'
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Moderate to severe acne or acne on the back or interferes with wearing equipment requires evaluation for oral medications and temporary profile. Scarring and hyperpigmentation requires more aggressive therapy to avoid further permanent scarring. There can be psychological effects from acne. It is important to identify Soldiers that are very self-conscious and escalating the treatment regimen to quickly control the acne.'
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-3",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Facial Cellulitis" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Abscess requiring drainage on face or neck" },
                    { text: "Signs of scarring" },
                    { text: "Requiring limitations on protective equipment" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['facial cellulitis', 'abscess'],
                                text: 'Facial cellulitis or a draining abscess are signs of a skin infection and not pseudofolliculitis barbae. These conditions require further evaluation and treatment. Cellulitis of the face can have life threatening complications.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Failed conservative therapy" },
                    { text: "Requesting profile" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'After failure of conservative therapy and lifestyle modifications, a permanent profile may need to be considered. Refer to the AEM for counseling prior to initiating the next step in therapy'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['acne', 'pseudofolliculitis barbae'],
                                text: 'shaving routine modifications are the first line in treatment. The following adjustments can help reduce the penetration of the inter-follicular skin by the hair shaft. Instruct the Soldier to wash the face in a circular motion with soap and warm water once a day to free any embedded hairs. Use a warm compress or warm water on the face before shaving and apply generous amounts of shaving cream for five minutes before shaving to soften the hair. Use a single blade razor, shave in the direction of hair growth, and avoid stretching the skin during shaving to reduce the production of very short hairs. Medication can be used in conjunction with the shaving routine modifications. A topical retinoid at night with or without the combination of a low potency topical steroid. Bumps associated with pseudofolliculitis barbae can remain for a few months after treatment has been started. Instruct the Soldier to return if the symptoms are worsening, new symptoms develop, or the minor-care protocol does not appear to be helping after a few weeks.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Counsel the Soldier on shaving routine modification to include washing the face in a circular motion, warm compress and leaving shaving cream on for 5 min prior to shaving, and using a single blade razor. Topical retinoid with or without a low potency steroid can be used once a day at night as an adjunct. RTC if symptoms are worsening, new symptoms developing, or symptoms are not controlled with the MCP',
                                    ancillaryFind: [{
                                        type: 'med',
                                        modifier: "tretinoin / topical retinoid"
                                    }],
                                    medFind: [medList[21]]
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-4",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Scaling with Visible Inflammation" },
                    { text: "Abnormal Sensation" },
                    { text: "Painful Erosions" }
                ],
                answerOptions: []
            },
            {
                text: "Red Flags present?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”'
                            },
                            {
                                type: 'dmp',
                                ddx: ['seborrheic dermatitis'],
                                text: 'Visible inflammation with patchy, orange to salmon-colored or grayish plaques covered with yellowish, greasy scales, concretions of scale around hair shafts, lesions consisting of fissures, oozing, and crusting, are all signs of a more severe form of scalp seborrheic dermatitis.'
                            },
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "2nd complaint" },
                    { text: "Medicated shampoo not (stopped) working" },
                    { text: "Developed new/worsening symptoms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['dandruff'],
                                text: 'Dandruff can be a chronic relapsing condition even in its mild form. All Antifungal shampoos are not the same and Soldiers may have different responses to them. OTC treatment may take some trial and error to find the shampoo that is right for the Soldier. Inflammation, lesions with oozing and crusting are signs that the symptoms are getting worse and the Soldier needs to be evaluated inside of a clinic setting.',
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['mild dandruff'],
                                text: 'there are some risk factors that make a Soldier more susceptible. Some risk factors include if the Soldier is male, Soldier has excessively oily skin and hair and/or if the Soldier suffers from certain diseases (ex. Parkinson’s disease, HIV). antifungal shampoo used daily (two to three times per week minimal) for several weeks and remission is achieved. Manage stress levels, spend time (a few minutes) outdoors in the sun (DO NOT sunbathe). Instruct the Soldier to seek medical assistance if mild dandruff is still present and not improving after three to four weeks of antifungal shampoo use, symptoms worsen, or new symptoms begin.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Antifungal shampoo used daily (minimum of 2-3 x per week) or several weeks and remission is achieved. Manage stress levels. Spend time (a few minutes) outdoors in the sun (DO NOT sunbathe). RTC if mild dandruff is still present after 3-4 weeks of antifungal shampoo use, symptoms worsen, or new symptoms begin.',
                                    ancillaryFind: [
                                        {
                                            type: 'med', modifier: 'selenium sulfide 1% shampoo'
                                        }
                                    ]
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-5",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [{ text: 'no red flags' }],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "New medication" },
                    { text: "Lack hair follicles" },
                    { text: "Smooth, circular hair loss" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['medication induced hair loss', 'scarring', 'alopecia areata'],
                                text: 'Examples of medications that can result in hair loss are propranolol, ketoconazole, isotretinoin, colchicine, and cholesterol medications. If hair follicles are not present on exam, then scarring hair loss is more likely requiring a referral to dermatology. Alopecia areata is described as smooth, circular discrete hair loss that occurs over a couple of weeks. Refer to a privileged provider for consideration of intra-lesion steroid injections.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Tinea capitis" },
                    { text: "Papules, pustules" },
                    { text: "Erythema" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['tinea capitis'],
                                text: 'Tinea capitis is a fungal infection of the scalp that presents with itching, scaling, and hair loss. It is common in kids but can occur in adults. Treatment is with an oral antifungal. Papules, pustules, and erythema are signs of inflammation which require further evaluation.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['traction alopecia'],
                                text: 'hair loss associated with traction being applied to hair for an extended period of time from tight hair styles often over the frontal and temporal areas. It is associated with traction folliculitis which includes erythema, papules, and sterile pustules. Instruct Soldier to avoid tight hair styles, chemical straighteners, and heating the hair follicle (curling iron, straight iron) till it has resolved. Refer to AEM if signs of inflammation are present to evaluate for treatment with a high potency topical steroid or intra-lesion steroid inject.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'counsel Soldier to avoid tight hair styles, chemical relaxants, and applying heat to hear until resolved. Refer to AEM for further evaluation if signs of inflammation are present. RTC if symptoms worsen or new symptoms begin'
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['male/female pattern hair loss'],
                                text: 'male pattern hair loss often occurs after age 30 with hair loss over the frontal, temporal, and top of the head. On examination hair follicles with a decreased caliber will be seen. Female pattern hair loss occurs over the front and top of the head. It most often occurs after menopause. Instruct the Soldier on the diagnosis',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'discuss the suspected diagnosis with the AEM and then provide counseling to the patient. RTC if symptoms worsen or new symptoms begin'
                                }
                            },
                            {
                                type: 'dmp',
                                text: 'Refer to AEM if does not meet either of the above patterns. Return to clinic if symptoms worsen or new symptoms develop.'
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-6",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Diabetic Soldiers" },
                    { text: "Significant erosions/ulcerations or malodor in affected area" },
                    { text: "Soldiers w/weakened immune systems" }
                ],
                answerOptions: []
            },
            {
                text: "Red Flags present?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”'
                            },
                            {
                                type: 'dmp',
                                ddx: ['athlete\'s foot', 'secondary bacterial infection'],
                                text: 'Peeling, cracking, redness, blisters, and breakdown of the skin with itching and burning are characteristics of both dry skin and athlete’s foot. If untreated, the fungal infection can lead to a severe secondary bacterial infection.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Rash with no improvement or response to medication" },
                    { text: "Blisters and ulcers" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Some fungal infections are unresponsive to topical medications and a systemic antifungal treatment is required. Ulcers increase the risk of a secondary bacterial infection.'
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['interdigital tinea pedis', 'hyperkeratotic tinea pedis', 'vesiculobullous tinea pedis'],
                                text: 'this type of fungal infection requires keratin for growth, which restricts the infection to the superficial skin, hair, and nails. Interdigital tinea pedis, hyperkeratotic (moccasin-type) tinea pedis and vesiculobullous (inflammatory) tinea pedis are the three major categories of tinea pedis infections. topical antifungal therapy can used to cure a fungal infection which has no secondary infection. Antifungal cream is applied twice a day for four to eight weeks. Instruct the Soldier to return to the clinic if the fungal infection does not respond to OTC medications, symptoms worsen, new symptoms develop. Prevention measures: athlete\'s foot can be spread through direct and indirect contact: direct, skin-to-skin contact, as may occur when an uninfected person touches the infected area of somebody with athlete\'s foot or indirect contact, in which the fungi can infect people via contaminated surfaces, clothing, socks, shoes, bed sheets, and towels. Instruct Soldier to keep his or her feet clean and dry, change socks regularly, wear well ventilated shoes and provide feet protection in public places. Use antifungal powder daily, alternate shoes and do not share shoes.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Antifungal lotion, ointment, powder, or spray-allied twice a day for 4-8 weeks. RTC if the fungal infection does not respond to medications, symptoms worsen, new symptoms develop. Prevention: instruct patient to keep their feet dry, change socks regularly, wear well ventilated shoes and provide feet protection in public places. Use antifungal powder daily, alternate shoes and do not share shoes.',
                                    medFind: [medList[41]]
                                }
                            },
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-7",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Diabetes" },
                    { text: "Immunodeficiency" }
                ],
                answerOptions: []
            },
            {
                text: "Red Flags present?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[0], modifier: 'Perform potassium hydroxide (KOH) examination' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”'
                            },
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Itchy, red rash in the groin area" },
                    { text: "No improvement in 2 weeks" },
                    { text: "Reoccurring infection" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[0], modifier: '' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: 'Diabetes can affect every part of the body, including the skin. Soldiers with diabetes are more susceptible to skin conditions such as bacterial infections and fungal infections. Although common infections can be self-treated, the Soldier should see a privileged provider to rule out other more serious diabetic related skin conditions.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Itchy, red ring-shaped rash in the groin area?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: 'Some infections and rashes do not respond well to OTC medications and infections may not get better or may reoccur within a few weeks. These Soldiers need to be evaluated to rule out more serious skin conditions. A normal infection may respond better to a prescription strength antifungal.'
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: false
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: 'Note: In the absence of any of the preceding conditions, minor-care is appropriate.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['tinea cruris'],
                                text: 'far more common in men than women. Predisposing factors include copious sweating, obesity, diabetes, and immunodeficiency. OTC medication: topical antifungal medication twice a day for two weeks. Instruct Soldier to keep groin area clean and dry and return to clinic if symptoms worsen, new symptoms develop, symptoms not improving within two weeks, or if the infection returns within a few weeks after using OTC Medications.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'topical antifungal medications twice a day for 2 weeks. Instruct patient to keep groin area clean and dry and RTC if symptoms worsen, new symptoms develop, symptoms not improving within 2 weeks, or if the infection returns within a few weeks after using medications. Preventive - hygiene',
                                    medFind: [medList[41]],
                                    ancillaryFind: [{ type: 'med', modifier: 'clotrimazole 1% cream' }]
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-8",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [{ text: 'no red flags' }],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Failed treatment" },
                    { text: "Widespread" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[0], modifier: 'perform potassium hydroxide (KOH) examination' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['tinea versicolor'],
                                text: 'Tinea versicolor that has failed initial therapy or is widespread may require systemic treatment. Presence of scale in the area and a positive KOH test confirms treatment failure requiring systemic treatment. Refer to the supervising privileged provider for counseling and evaluation for treatment.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Recurrent" },
                    { text: "Unidentified" },
                    { text: "Atypical presentation" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['tinea versicolor'],
                                text: 'Tinea versicolor often reoccurs. When this occurs, additional counseling to the Soldier is required to help prevent further occurrences. Refer to the AEM for additional counseling and preventative measures. If it is an atypical presentation that you do not recognize, refer to the AEM for further evaluation and treatment'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['tinea versicolor'],
                                text: 'treat with topical terbinafine twice a day for one week. Selenium sulfide 2.5% shampoo lathered over the affected area and left for 10 minutes once a week is also effective. Instruct the Soldier that hypo/hyperpigmentation of the area may remain for months after effective treatment. If the presentation is not classic for tinea versicolor, screen according to the appropriate protocol and discuss with the AEM. Return to the clinic for worsening symptoms, new symptoms, or presence of scale in the lesions after treatment.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Topical antifungal medications twice a day for 1 week. Instruct patient that the hypo/hyper pigmented areas can remain for months after effective treatment. If the presentation is atypical, screen according to the identified lesion. If not able to identify the lesion, refer to the AEM for further evaluation and treatment. RTC for worsening symptoms, new symptoms, or presence of scale in the lesions after treatment.',
                                    ancillaryFind: [{ type: 'med', modifier: 'selenium sulfide 2.5% shampoo' }],
                                    medFind: [medList[41]],
                                }

                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-9",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Location over Tailbone" },
                    { text: "SIRS Criteria" },
                    { text: "Worsening on Antibiotics" },
                    { text: "Palm of Hand" },
                    { text: "Over Joint" },
                    { text: "Black Eschar" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "red flags" },
                    { text: "Fever" },
                    { text: "Rapid progression" },
                    { text: "Cellulitis" },
                    { text: "Indwelling medical device" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[0], modifier: 'prepare informed consent, timeout, I&D set-up if provider requests' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['abscess', 'epidermal cyst', 'septic joint', 'hidradenitis suppurativa'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.'
                            },
                            {
                                type: 'dmp',
                                text: 'Pilonidal abscesses (over the tail bone) can be much larger than they appear and should be referred to a privileged provider for evaluation. Systemic inflammatory response syndrome (SIRS) criteria, fever, black eschar, rapid progression over hours, and worsening on oral antibiotics are signs of a more significant infection that may require hospitalization. Hand infection, infection over a joint, indwelling medical device, and associated cellulitis increases the risks of serious complications.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Fluctuant mass" },
                    { text: "Multiple abscesses" },
                    { text: "Drained abscess > 5cm diameter" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [{ ...Disposition[1], modifier: 'prepare informed consent, timeout, I&D set-up if provider requests' }],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['abscess', 'carbuncle', 'Staphylococcal '],
                                text: 'An abscess should be drained to allow it to heal, and an abscess with a diameter of greater than five cm will need to be packed. Military population is at risk for community transmission of staphylococcus aureus and should be evaluated for the addition of antibiotic therapy.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['abscess', 'furuncle', 'carbuncle'],
                                text: 'prior to abscess formation, the skin normally becomes indurated from the inflammation. The skin appears to be warm, red, and tender with a hard area where the inflammation is present. Treatment is minor care. An abscess may form within a couple of days requiring further treatment. Apply a moist, warm compress over the area for 20 minutes every four hours. It will increase blood flow to the area allowing the Soldier’s immune system to fight the infection. Instruct the Soldier to return to the clinic after the abscess forms for drainage. Return sooner if symptoms worsen (fevers, chills, increased pain or redness, red streaks, increased swelling, or re-accumulation of pus if it has already drained).',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Apply a warm moist compress over the abscess for 20 minutes every four hours. RTC for worsening symptoms (fever/chills, re-accumulation of pus, increased pain/redness, red streaks, or increased swelling), new symptoms, if not improving within 3 days.'
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-10",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Eye Pain" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red Flag" },
                    { text: "Burns" },
                    { text: "Eczema" },
                    { text: "Severe pain" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['keratitis', 'HSV-1'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.'
                            },
                            {
                                type: 'dmp',
                                text: 'HSV-1 infection can occur at any mucosal or skin site. Although rare, eye infection with HSV causes keratitis. Eczema and burns result in breaks in the skin\'s natural protective barrier increasing the risk of spreading the HSV infection to these areas.'
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['viral infection', 'cold sore', 'bacterial infection'],
                                text: 'Elevated temperature, sore throat, sores on the hand, and moderate to severe pain increase the chance of an alternative viral infection or initial infection requiring further evaluation and possible systemic antiviral therapy. Pustules and yellow, honeycomb crusting suggest a bacterial infection requiring further evaluation.'
                            }
                        ],
                        next: 2,
                        selectAll: false
                    }
                ],
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Sore throat" },
                    { text: "Hand sore" },
                    { text: "Pustule, yellow crusting" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['fever blister (cold sore)'],
                                text: 'instruct Soldier on contagious nature of HSV-1, cold sores. When symptomatic or cold sores are present, the Soldier is very contagious, and the virus is spread through direct contact. Instruct the Soldier to avoid sharing drinks or kissing anyone until after it has resolved. Provide docosanol (Abreva) topical ointment to be applied to the cold sore five times a day or two doses of valacyclovir 2g 12 hours apart. Return to clinic if symptoms are worsening, new symptoms develop, or it is not improved within 10 days.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Counsel the Soldier on the contagious nature of the virus and to avoid sharing a drink or kissing anyone till it has resolved. Provide doconasol topical ointment (1st line) to be applied 5 x per day till cold sore is healed or valacyclovir (2nd line). RTC if symptoms worsen, new symptoms develop, or it is not improved within 10 days',
                                    ancillaryFind: [{ type: 'med', modifier: 'doconasol topical ointment' }],
                                    medFind: [medList[43]]

                                }
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-11",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "SIRS criteria" },
                    { text: "Animal Bite, Scratch" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: 'red flags' },
                    { text: 'fever' },
                    { text: 'red streaks' },
                    { text: 'oozing fluid' },
                    { text: 'tetanus risk' },
                    { text: 'high risk wound' }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['sepsis', 'bacterial infection', 'tetanus risk'],
                                text: 'Systemic Inflammatory Response Syndrome (SIRS) criteria includes two of the following: heart rate over 90 bpm, respiratory rate over 20, Temp >100.4 or <96.8o F, or WBC >12,000 cells. SIRS criteria with a source of infection is sepsis and requires prompt treatment. Fever, red streaks, and oozing wounds indicate an infection that requires further evaluation and treatment. Puncture wounds, avulsions, from crushing or burns, and wounds contaminated with dirt, saliva, or feces require tetanus immunization if not given within last five years. Clean wounds require tetanus immunization if not given within last 10 years. High risk wounds increase the risk of complications. Bite wounds have a risk of infection. Lacerations over a joint, on the face, or on the hand or foot have a higher risk of complication from the laceration.'
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ],
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: 'Erythema > 1 inch' },
                    { text: 'increased warmth' },
                    { text: 'increased tenderness' },
                    { text: 'laceration' },
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Erythema, warmth, and increased tenderness are signs of inflammation or an early infection that requires further evaluation. A laceration needs to be evaluated to determine if it needs to be closed.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Gently wash the affected area with soap and water. If there is a laceration, irrigate inside the laceration using a syringe with jets of sterile saline. While washing and irrigating the wound, ensure that all foreign material has been removed from the wound.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['abrasion'],
                                text: 'cover the abrasion with an antibacterial ointment. Provide the ointment for the Soldier to apply to the abrasion twice a day. Cover the abrasion with a protective, non-stick sterile dressing and have the Soldier change the dressing daily or when saturated with fluid. Keep the area clean and dry.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Wash the area with soap and water. Ensure the area is thoroughly irrigated and all foreign material has been removed. Cover the area with an antibiotic ointment and sterile dressing. Provide materials for wound care. Counsel the Soldier on how to take care of the wound. RTC for increasing redness, bad smell, thick discharge, increasing tenderness, or other concerns.',
                                    medFind: [medList[7]]
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['laceration'],
                                text: 'if the edges of the wound can be brought together easily, bleeding is controlled, and there are no signs of infection, minor-care is appropriate. Steri-strips may be applied to keep the skin edges together. If it is a laceration, return to clinic in 24-48 hours for re-evaluation. Otherwise, return to clinic for increasing redness, bad smell, thick discharge, increasing tenderness, or other concerns to include the edges becoming separated.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Wash the area with soap and water. Ensure the area is thoroughly irrigated and all foreign material has been removed. Cover the area with an antibiotic ointment and sterile dressing. Provide materials for wound care. Counsel the Soldier on how to take care of the wound. RTC for increasing redness, bad smell, thick discharge, increasing tenderness, or other concerns.',
                                    ancillaryFind: [{ type: 'protocol', modifier: 'steri-strips' }],
                                    medFind: [medList[7]]
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-12",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Fever" },
                    { text: "Pus/redness/swelling" }
                ],
                answerOptions: []
            },
            {
                text: "Red Flags?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ],
            },
            {
                text: "Incomplete closure?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[1]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [Disposition[2]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-13",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Airway Swelling" },
                    { text: "Wheezing" },
                    { text: "Anaphylaxis" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red Flags" },
                    { text: "Blistering" },
                    { text: "Oral involvement" },
                    { text: "Petechiae" },
                    { text: "Fever" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: 'action placeholder'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "No new medication within 2 weeks" },
                    { text: "Itchy rash with other symptoms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-14",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Trouble Breathing" },
                    { text: "AMS, Drowsy" },
                    { text: "High Risk Location" },
                    { text: "Circumferential Burn" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags present" },
                    { text: "Deep 2nd and 3rd degree" },
                    { text: "> 10% of body" },
                    { text: "Trauma" },
                    { text: "Severe pain" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Second degree burn" },
                    { text: "Secondary infection" },
                    { text: "Sunburn >25% of body" },
                    { text: "Exhaustion" },
                    { text: "Unable to perform duties" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-15",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Fever/malaise" },
                    { text: "Epidermal sloughing" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Flu like symptoms" },
                    { text: "Painful erythematous macules" },
                    { text: "Trauma" },
                    { text: "Exposure to new medications" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Large open blister" },
                    { text: "Erythema or other signs of infection" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-16",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Foot Exam",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags" },
                    { text: "Diabetes mellitus" },
                    { text: "Decreased peripheral sensation to light touch" },
                    { text: "Lesion freely bleeds with paring" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Plantar wart" },
                    { text: "Interfere with normal duty" },
                    { text: "Bunion" },
                    { text: "Mallet or hammer toe" },
                    { text: "Decreased toe motion" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-17",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Skin Exam",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Bleeding" },
                    { text: "Sensitive area" },
                    { text: "> 10 warts" },
                    { text: "Upcoming mission limiting treatment" },
                    { text: "Signs of infection or inflammation" },
                    { text: "Treatment > 12 weeks" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "> 3 warts" },
                    { text: "Treatment > 4 weeks" },
                    { text: "Medic not trained on procedure" },
                    { text: "Complication from prior treatment" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "J-18",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Red Streaks up Foot" },
                    { text: "Gangrene" },
                    { text: "Black Eschar" }
                ],
                answerOptions: []
            },
            {
                text: "Skin Exam",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red flags present" },
                    { text: "Cellulitis" },
                    { text: "Immunocompromised" },
                    { text: "Diabetic" },
                    { text: "Severe infection" },
                    { text: "Recurrent ingrown nail" },
                    { text: "Severe pain, limping" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Moderate infection" },
                    { text: "Limitations to duty" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "K-1",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Altered mental status" },
                    { text: "Abnormal vital signs" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Patient appears confused, delirious, or unresponsive" },
                    { text: "Dry skin" },
                    { text: "Temperature > 103&#176; F" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Is the patient sweating profusely; do they complain of headache, weakness, dizziness, and/or nausea" },
                    { text: "Is the patient complaining of painful cramps of the extremities and/or abdominal muscles and is their body temperature normal" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "K-2",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "T<96 degrees F" },
                    { text: "Altered Mental Status" },
                    { text: "Abnormal Vital Signs" },
                    { text: "Frostbite" },
                    { text: "Trauma" }
                ],
                answerOptions: []
            },
            {
                text: "Rectal Temp",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red Flags" },
                    { text: "Neurologic Symptoms" },
                    { text: "Infection" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "H/O psych meds or narcotics" },
                    { text: "H/O alcohol abuse" },
                    { text: "Severe Pain" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 4,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Immersion Foot?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Screen Immersion Foot K-3"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "K-3",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Gangrene/Necrosis" },
                    { text: "Hemorrhagic Blisters" },
                    { text: "Hypothermia" },
                    { text: "Frostbite" },
                    { text: "Trauma" }
                ],
                answerOptions: []
            },
            {
                text: "Extremity Exam",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red Flags" },
                    { text: "Severe pain" },
                    { text: "Signs of infection" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Unable to perform duties" },
                    { text: "Symptom > 1 week" },
                    { text: "Pain not controlled" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "K-4",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Diffuse symptoms" },
                    { text: "Not exposed to dry wind" },
                    { text: "Signs of infection" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "K-5",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "White or greyish-yellow color" },
                    { text: "Hard, or waxy to touch" },
                    { text: "Blisters, cyanosis after rewarming" },
                    { text: "Hypothermia" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "K-6",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Secondary infection" },
                    { text: "No nits or lice seen" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "K-7",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Swelling of Lips or Tongue" },
                    { text: "Trouble Breathing" },
                    { text: "Abnormal Vital Signs" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Wheezing, SOB" },
                    { text: "Hives, H/O allergy" },
                    { text: "Poisonous insects" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "No signs of bite" },
                    { text: "Blister, ulcer, pain" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "L-1",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Known Infection" },
                    { text: "High Risk Contact" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red Flags" },
                    { text: "High risk exposure" },
                    { text: "Exposure with HIV" },
                    { text: "In a lab" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: ">7 days from exposure" },
                    { text: "No risk exposure" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                                modifier: "Treatment Protocol"
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "L-2",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Exposed Pulp" },
                    { text: "Avulsed Tooth" },
                    { text: "Severe Pain" },
                    { text: "Trauma" },
                    { text: "Chest Pain, SOB" }
                ],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red Flags" },
                    { text: "Loose tooth" },
                    { text: "Abscess/ infection" },
                    { text: "Gingivitis, periodontitis" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Broken tooth" },
                    { text: "Issue not below" },
                    { text: "Jaw pain not from trauma" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[1],
                                text: "Dentist or AEM Now"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                                modifier: "Treatment Protocol"
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "L-3",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Diffuse" },
                    { text: "Bloody Diarrhea" }
                ],
                answerOptions: []
            },
            {
                text: "Oral Exam",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Red Flags" },
                    { text: "Painless" },
                    { text: "Also located in groin" },
                    { text: "H/O bloody diarrhea" },
                    { text: "Diffuse rash" },
                    { text: ">2 weeks" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Cluster of ulcers" },
                    { text: ">5mm ulcer" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2],
                                modifier: "Treatment Protocol"
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "L-4",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Narcotic, Psych med" },
                    { text: "Sleeping med" },
                    { text: "Birth control" },
                    { text: "Chronic medication" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Place secure message or T-Con for Provider"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Acute condition that failed initial treatment" },
                    { text: "Prescription" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[1],
                                text: "Refer to AEM"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Provide Acute OTC Medication"
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "L-5",
        options: [
            {
                text: "Provide Counseling",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Not stable relationship" },
                    { text: "No children" },
                    { text: "Under 30 years old" },
                    { text: "PCM Performs" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Schedule appointment with PCM"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Message Provider or Local Policy"
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "L-6",
        options: [
            {
                text: "Provide Counseling",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Rabies" },
                    { text: "Not required" },
                    { text: "Requested early" },
                    { text: "Contraindication for immunization" },
                    { text: "Medic not trained" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "CAT I",
                                text: "Provider Now (Rabies) or AEM Now"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[2]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "L-7",
        options: [
            {
                text: "Lymph node exam",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Multiple body areas" },
                    { text: "Unexplained weight loss" },
                    { text: "Supraclavicular" },
                    { text: "Posterior Cervical" },
                    { text: "Not mobile" },
                    { text: "Not soft" },
                    { text: "No recent infection" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Screen for infection Sx"
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "L-8",
        options: [
            {
                text: "Check blood pressure",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Greater than 150/90" },
                    { text: "Lower than 90 systolic" },
                    { text: "Difference > 15 mmHg between arms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Last day of 5 day blood pressure check" },
                    { text: "Orthostatic Hypotension" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[1],
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "CAT III",
                                text: "RTD"
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "L-9",
        options: [
            {
                text: "Record Review",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "MEDPROS RED?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Schedule appointment or Refer for Service"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Non-deployable profile" },
                    { text: "Behavioral Health" },
                    { text: "Specialty Care" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Schedule Appointment"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Fill out paper Provider review and sign"
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "L-10",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Enrolled in ABCP" },
                    { text: "BMI > 30 and not muscular build" },
                    { text: "Struggling with weight for >6 months" },
                    { text: "H/O failing Ht/Wt/Tape" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Schedule Provider Appointment",
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "New Issue" },
                    { text: "BMI > or equal to 25" },
                    { text: "Recent profile" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Wellness Center or Dietician Referral",
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Schedule Provider Appointment"
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "L-11",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Appears sick, AMS, uncomfortable" },
                    { text: "HR > 100, RR > 20" },
                    { text: "BP > 150/90" },
                    { text: "Moderate - Severe pain" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Complaint does not apply to another algorithm on the list?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Screen Symptoms"
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "L-12",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Current symptoms are present?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Screen Symptoms",
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Soldier is traveling on Temporary Duty to a location without easy access to medical care?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "CAT III",
                                text: "Provide Travel Pack Medications",
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Schedule Provider Appointment"
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "M-1",
        options: [
            {
                text: "Rescreen Algorithm",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Worsening on treatment" },
                    { text: "Previously saw provider or AEM" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Screened a Self Care or AEM?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    },
    {
        id: "M-2",
        options: [
            {
                text: "Rescreen if acutely ill",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "initial",
                questionOptions: [
                    { text: "Screening dispositioned as provider now" },
                    { text: "Condition worsening" },
                    { text: "Not improving" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Previously seen by provider or specialty clinic requesting Soldier to follow-up?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Make an Appointment",
                                modifier: "action placeholder"
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: [],
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Make an Appointment"
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            }
        ]
    }
]
