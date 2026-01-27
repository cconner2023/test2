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
        type: "OTHER",
        text: ""
    }
]


//Algorithms by id 'A-1' ex. to be linked by the 'icon' of the CatData.ts. I'm sure there's a better way to do this.
export const Algorithm: AlgorithmType[] = [
    {
        id: "A-1",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "SOB" },
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
                    { text: "Fever" }
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
                    { text: "Fever" },
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
                            // general DP for this step
                            {
                                type: 'dmp',
                                ddx: ['viral infection'],
                                text: 'Sore throat and hoarseness that are associated with a virus should be treated with minor-care. The other symptoms should be treated according to their associated protocols.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['sore throat'],
                                text: 'A sore throat is often due to a viral infection. Minor-care consist of pain control, measures to decrease inflammation, getting plenty of rest and drinking plenty of fluids (water). Return for signs of the infection getting worse or progressing.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'For pain: lozenge first line, ibuprofen second line, for elevated temperature: acetaminophen, salt water gargles and drink warm fluids for inflammation',
                                    medFind: [
                                        { ...medList[8] },
                                        { ...medList[0] },
                                        { ...medList[23] }
                                    ]
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['hoarseness'],
                                text: 'Hoarseness is often due to a virus or irritant. Minor-care consists of resting the vocal cords and avoidance of irritants (cigarette smoking, yelling, heartburn, post-nasal drip). This is a good opportunity to discuss the negative effects of tobacco use and encourage the Soldier to quit using tobacco, if applicable.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'rest vocal cords and avoid irritants (cigarette smoking, yelling, heartburn). Return if not improving in 3 days or immediately if worsening symptoms or red flags (above).'
                                }
                            }
                        ],
                        next: null,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Perform Rapid Strep + Culture Test (barracks, positive close contact, immunosuppressed contact, h/o ARF",
                type: "action",
                questionOptions: [
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
                            // general DP for this step
                            {
                                type: 'dmp',
                                ddx: ['viral infection'],
                                text: 'Sore throat and hoarseness that are associated with a virus should be treated with minor-care. The other symptoms should be treated according to their associated protocols.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['sore throat'],
                                text: 'A sore throat is often due to a viral infection. Minor-care consist of pain control, measures to decrease inflammation, getting plenty of rest and drinking plenty of fluids (water). Return for signs of the infection getting worse or progressing.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'For pain: lozenge first line, ibuprofen second line, for elevated temperature: acetaminophen, salt water gargles and drink warm fluids for inflammation',
                                    medFind: [
                                        { ...medList[8] },
                                        { ...medList[0] },
                                        { ...medList[23] }
                                    ]
                                }
                            },
                            {
                                type: 'dmp',
                                ddx: ['hoarseness'],
                                text: 'Hoarseness is often due to a virus or irritant. Minor-care consists of resting the vocal cords and avoidance of irritants (cigarette smoking, yelling, heartburn, post-nasal drip). This is a good opportunity to discuss the negative effects of tobacco use and encourage the Soldier to quit using tobacco, if applicable.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'rest vocal cords and avoid irritants (cigarette smoking, yelling, heartburn). Return if not improving in 3 days or immediately if worsening symptoms or red flags (above).'
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
                                ddx: ['meningitis'],
                                text: 'If the Soldier presents with any of the red flags, immediately disposition the Soldier as "Provider Now." A stiff neck and fever are signs of meningitis, and all Soldiers with signs of meningitis should be seen by a privileged provider as soon as possible. Mastoid symptoms can be a sign of mastoiditis.'
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        decisionMaking: [],
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
                    { text: "Ear drainage" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [],
                        decisionMaking: [],
                        next: [3, 4],
                        selectAll: true
                    },
                    {
                        text: "No",
                        disposition: [],
                        decisionMaking: [],
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
                text: "Are there TM s/s, concern for Otitis media, or concern for Mod-Severe Otitis Externa?",
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
                        decisionMaking: [],
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
                    { text: "Symptoms > 7 days" },
                    { text: "Decreased hearing" },
                    { text: "Foreign body in ear" },
                    { text: "Visual trauma to ear" }
                ],
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
                        decisionMaking: [],
                        next: 6,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Cold symptoms or Sore Throat Present?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [
                            {
                                ...Disposition[3],
                                text: "Rescreen as another complaint"
                            }
                        ],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: 'Evaluate for cold symptoms and sore throat that can be associated with ear pain with their respective protocols.'
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
                                text: 'Mild otitis externa, temporal-mandibular joint (TMJ) dysfunction, and ear pain with normal exam should be treated with minor-care.'
                            },
                            {
                                type: 'dmp',
                                ddx: ['Mild Otitis Externa'],
                                text: 'Soak wick of a cotton ball wick with OTC ear drops. Place in the ear for 24 hours while using the drops. Remove the cotton wick and continue drops for 1 week (3 days after the symptoms have resolved). Keep the ear canal dry. Use OTC ibuprofen as needed for pain. Return to clinic if not resolved in 1 week or worsening symptoms to include pain or fever.',
                                assocMcp: {
                                    type: 'mcp',
                                    text: 'Soak wick of a cotton ball with ear drops. Place in the ear for 24 hours while using the drops. Remove the cotton wick and continue drops for 1 week (3 days after the symptoms have resolved). Keep the ear canal dry',
                                    specLim: [
                                        'Avoidance of situations requiring utilization of ear plugs',
                                        'No swimming'
                                    ],
                                    ancillaryFind: [
                                        {
                                            type: 'med',
                                            modifier: 'peroxide carbamide otic drops'
                                        }
                                    ]
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
                    }
                ]
            }
        ]
    },
    // Search Tag A-3
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
                        decisionMaking: [],
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
                    {
                        text: "Productive cough",
                    },
                    {
                        text: "Symptoms > 7 days",
                    },
                    {
                        text: "Severe sinus or dental pain",
                    }
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
                        decisionMaking: [],
                        next: 3,
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    {
                        text: "Symptoms > 7 days",
                    },
                    {
                        text: "Rebound symptoms",
                    },
                    {
                        text: "Purulent discharge",
                    }
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
                        decisionMaking: [],
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
                    {
                        text: "Ringing > 24 hours",
                    },
                    {
                        text: "Ringing without MOI",
                    },
                    {
                        text: "Dizziness",
                    },
                    {
                        text: "Visual Trauma",
                    },
                    {
                        text: "Decreased hearing",
                    }
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
                                ddx: ['innear ear pathology'],
                                text: 'Ringing greater than 24 hours or related to an event requires further evaluation. Vertigo or “room-spinning dizziness” can be a symptom of inner ear problems and is often associated with nausea. Distinguish vertigo from light-headedness which is screened separately.'
                            }
                        ],
                        next: null,
                        selectAll: true,
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                    {
                        text: "Loud noise exposure or trauma within 24 hours",
                    },
                    {
                        text: "Ear drainage",
                    },
                    {
                        text: "Ear pain",
                    }
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
                text: "Is there TM opacification, immobility, rupture, Ear canal foreign body, or wax buildup?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        disposition: [Disposition[0]],
                        decisionMaking: [
                            {
                                type: 'dmp',
                                ddx: ['TM rupture', 'inner ear pathology', 'foreign body', 'excessive wax'],
                                text: 'Trauma and blast injuries can result in Tympanic Membrane or inner ear problems. Foreign body or excessive wax within the ear canal can result in reversible hearing loss. If excessive wax is present, discuss removal with supervisor.'
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
                        decisionMaking: [],
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
                                ddx: ['strain', 'sprain'],
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
    // Search Tag B-2
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
                        disposition: [Disposition[0]],
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
                                text: "AEM Now, PT if available"
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
                                text: 'Significant force of trauma to include car accident can cause a hip fracture. Immobilize the affected extremity prior to transport. Pain with weight bearing or starts after a certain point during exercise can be a sign of a stress injury. Increase in exercise, long endurance training, or recent modification to training can be risk factors of a stress injury. Place the Soldier on crutches with toe touch weight bearing until a bone stress injury is ruled out.'
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Greater than 72 hrs" },
                    { text: "Signs of fluid depletion, orthostatic hypotension" },
                    { text: "Unable to maintain oral intake" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[1],
                                modifier: "Pregnancy Screen/Test"
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
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: [4, 5],
                        selectAll: false
                    }
                ]
            },
            {
                text: "Pregnancy Screen/Test",
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
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[3],
                                text: "Screen heartburn, headache, dizziness, pregnancy, or other symptoms if present"
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Recent hospital stay" },
                    { text: "Recent antibiotics" },
                    { text: "Bloody diarrhea" },
                    { text: "H/O inflammatory bowel disease" },
                    { text: "Severe abdominal pain" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "> 6 unformed stools in 24 hours" },
                    { text: "Hypovolemia" },
                    { text: "Dizziness" },
                    { text: "3+ days" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                text: "Pregnancy Screen/ Test",
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Loss of appetite" },
                    { text: "Followed by nausea" },
                    { text: "Present for 1+ weeks" },
                    { text: "Testicular symptoms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                                text: ''
                            }
                        ],
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
                                text: ''
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "Hemocult positive, Unable to obtain stool sample"
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
                    { text: "H/O anal sex" },
                    { text: "Low back problems" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                text: "Rectal bleeding?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[3],
                                text: "Screen rectal bleeding or other symptoms if present"
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
                text: "Red Flags?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Sudden onset during eating" },
                    { text: "Inability to swallow (drooling)" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                text: "Started before a sore throat?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]], // CAT II: AEM Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                text: "Sore throat started first?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[3],
                                text: "Screen sore throat or other symptoms if present"
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Tachycardia" },
                    { text: "Sweating" },
                    { text: "Shoulder/Jaw Pain" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[0],
                                modifier: "Oxygen, EKG, chewable aspirin"
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
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]], // CAT II: AEM Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                text: "Classic symptoms of heartburn?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[3],
                                text: "Screen other symptoms if present"
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
                                text: ''
                            }
                        ],
                        disposition: [Disposition[2]], // CAT III
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
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]], // CAT I: Provider Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Irregular pulse" },
                    { text: "Sweating" },
                    { text: "Chest, shoulder, jaw pain or pressure" },
                    { text: "H/O or FH of heart problems" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
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
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]], // CAT II: AEM Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Cold like symptoms" },
                    { text: "Allergy symptoms" },
                    { text: "H/O panic attacks" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[2]], // CAT III: Treatment Protocol and RTD
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]], // CAT II: AEM Now
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
                                text: ''
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
                text: "Pregnancy Test",
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
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[1],
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                text: "Hematuria?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[1],
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
                text: "Pregnancy Test",
                type: "action",
                questionOptions: [],
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
                    { text: "Skin lesion" },
                    { text: "Rash" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                text: "Urinalysis / Pregnancy Test",
                type: "action",
                questionOptions: [],
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
                    { text: "Vertigo" },
                    { text: "Appears anxious" },
                    { text: "Prevent normal duties" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
        id: "F-3",
        options: [
            {
                text: "Red Flags",
                type: "rf",
                questionOptions: [
                    { text: "Localized to a Region or 1 sided" },
                    { text: "Recent Trauma" },
                    { text: "Loss of Consciousness" },
                    { text: "Bowel/Bladder Incontinence" }
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
                    { text: "Back Pain" },
                    { text: "Severe headache" },
                    { text: "Blood glucose less than 70" },
                    { text: "Diabetes using insulin" },
                    { text: "Tick exposure" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: [3, 4],
                        selectAll: false
                    }
                ]
            },
            {
                text: "Pregnancy Test",
                type: "action",
                questionOptions: [],
                answerOptions: []
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Fever" },
                    { text: "Prevents normal activities" },
                    { text: "First occurrence of symptoms" },
                    { text: "Pregnant" },
                    { text: "Depressed" },
                    { text: "35+ years old" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: [3, 4],
                        selectAll: false
                    }
                ]
            },
            {
                text: "Blood Alcohol UDS",
                type: "action",
                questionOptions: [],
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Positive depression screening" },
                    { text: "Difficulty adjusting to injury or pain" },
                    { text: "Escorted due to safety concerns" },
                    { text: "Positive blood alcohol" },
                    { text: "Other indications of depression/anxiety" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Cold, Sore throat Sx" },
                    { text: "Rectal bleeding" },
                    { text: "Other symptoms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Screen bleeding, cold, sore throat, other symptoms if present"
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Cold, Sore throat Sx" },
                    { text: "Ear pain" },
                    { text: "Diarrhea" },
                    { text: "Pain with urination" },
                    { text: "Other symptoms" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Screen other symptoms algorithm"
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Significant redness, swelling" },
                    { text: "Rash > 1 week" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "contact wearer" },
                    { text: "Onset within 7 days" },
                    { text: "Painful" },
                    { text: "Red" },
                    { text: "Headache" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Appears intoxicated" },
                    { text: "With 1 eye shut" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Male with H/O testosterone supplement" },
                    { text: "Female breastfeeding" },
                    { text: "Repeat visit" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                text: "Check hCG",
                type: "action",
                questionOptions: [],
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
                text: "Positive HCG without other symptoms?",
                type: "choice",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: false
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                text: "Check hCG",
                type: "action",
                questionOptions: [],
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: [3, 4],
                        selectAll: false
                    }
                ]
            },
            {
                text: "Menses History: Length, Severity (clots, #pads), Medications",
                type: "action",
                questionOptions: [],
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                text: "Check hCG",
                type: "action",
                questionOptions: [],
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Moderate vaginal pain" },
                    { text: "Presentation different from the treatment protocol descriptions" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
        id: "I-5",
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
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]], // CAT I: Provider Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2, // Goes to next question
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
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Schedule appointment"
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
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Schedule appointment"
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
        id: "I-6",
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
                    { text: "Pregnant" },
                    { text: "Medication side-effects" },
                    { text: "H/O recent unprotected sex" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                    { text: "Discuss effectiveness of each type of contraceptive" },
                    { text: "Discuss contraceptive preferences" },
                    { text: "Discuss additional benefits" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Schedule appointment or referral"
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
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "OTHER",
                                text: "Schedule appointment or referral"
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]], // CAT I: Provider Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2, // Goes to next question
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
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]], // CAT II: AEM Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2], // CAT III: Treatment Protocol and RTD
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
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]], // CAT I: Provider Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2, // Goes to next question
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
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]], // CAT II: AEM Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2], // CAT III: Treatment Protocol and RTD
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
                questionOptions: [],
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
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]], // CAT I: Provider Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2, // Goes to next question
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
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]], // CAT II: AEM Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2], // CAT III: Treatment Protocol and RTD
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
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]], // CAT I: Provider Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2, // Goes to next question
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
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]], // CAT II: AEM Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2], // CAT III: Treatment Protocol and RTD
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
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]], // CAT I: Provider Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2, // Goes to next question
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
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]], // CAT I: Provider Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 3, // Goes to next question
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
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]], // CAT II: AEM Now
                        next: null,
                        selectAll: false
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                ...Disposition[2], // CAT III: Treatment Protocol and RTD
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
                questionOptions: [], // No red flags in catData
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
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]], // CAT I: Provider Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2, // Goes to next question
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
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[1]], // CAT II: AEM Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                text: "Red Flags?",
                type: "initial",
                questionOptions: [],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]], // CAT I: Provider Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 2, // Goes to next question
                        selectAll: false
                    }
                ]
            },
            {
                text: "Do any of the following apply?",
                type: "choice",
                questionOptions: [
                    { text: "Fever" },
                    { text: "Rapid progression" },
                    { text: "Cellulitis" },
                    { text: "Indwelling medical device" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [Disposition[0]], // CAT I: Provider Now
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [
                            {
                                type: 'dmp',
                                text: ''
                            }
                        ],
                        disposition: [],
                        next: 3, // Goes to next question
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
                        decisionMaking: [
                            {
                                type: 'dmp',
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
                                text: ''
                            }
                        ],
                        disposition: [
                            {
                                type: "CAT I",
                                text: "Provider Now",
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                    { text: "Sore throat" },
                    { text: "Hand sore" },
                    { text: "Pustule, yellow crusting" }
                ],
                answerOptions: [
                    {
                        text: "Yes",
                        decisionMaking: [],
                        disposition: [
                            {
                                type: "CAT II",
                                text: "AEM Now",
                                modifier: null
                            }
                        ],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
                        disposition: [
                            {
                                type: "CAT III",
                                text: "Treatment Protocol and RTD",
                                modifier: "Treatment Protocol" // Action from the HTML
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
                        decisionMaking: [],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[0]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
                        disposition: [Disposition[1]],
                        next: null,
                        selectAll: true
                    },
                    {
                        text: "No",
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
                        decisionMaking: [],
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
