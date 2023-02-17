if ("serviceWorker" in navigator) {
  window.addEventListener("load", function() {
    navigator.serviceWorker
      .register("/serviceWorker.js")
      .then(res => console.log("service worker registered"))
      .catch(err => console.log("service worker not registered", err))
  })
}


//defining parent elements
const menu = document.querySelector("#item-menu");
const complaints = document.querySelector(".complaint-box");
const homecatbox = document.querySelector("#homecatbox");
const Acontainer = document.querySelector(".ADTcontainer");
const ADTpage = document.querySelector(".ADTpage");
const return2 = document.querySelector(".return-btn2")
const homebanner = document.querySelector("#banner1");
const banner = document.querySelector("#banner2");
const subbanner = document.querySelector("#banner3");
const algorithm = document.querySelector(".algorithm");
//Main category buttons (to go to the subcategories A, B, C, D)
const btnA = document.querySelector("#btn-A");
const btnB = document.querySelector("#btn-B");
const btnC = document.querySelector("#btn-C");
const btnD = document.querySelector("#btn-D");
const btnE = document.querySelector("#btn-E");
const btnF = document.querySelector("#btn-F");
const btnG = document.querySelector("#btn-G");
const btnH = document.querySelector("#btn-H");
const btnI = document.querySelector("#btn-I");
const btnJ = document.querySelector("#btn-J");
const btnK = document.querySelector("#btn-K");
const btnL = document.querySelector("#btn-L");
const btnM = document.querySelector("#btn-M");
//Subcategory boxes (A, B, C, D, E)
const Abox = document.querySelector("#subboxA");
const Bbox = document.querySelector("#subboxB");
const Cbox = document.querySelector("#subboxC");
const Dbox = document.querySelector("#subboxD");
const Ebox = document.querySelector("#subboxE");
const Fbox = document.querySelector("#subboxF");
const Gbox = document.querySelector("#subboxG");
const Hbox = document.querySelector("#subboxH");
const Ibox = document.querySelector("#subboxI");
const Jbox = document.querySelector("#subboxJ");
const Kbox = document.querySelector("#subboxK");
const Lbox = document.querySelector("#subboxL");
const Mbox = document.querySelector("#subboxM");
//labels (A-1, A-2) that act as buttons
const A1label = document.querySelector("A1label"),
A2label = document.querySelector("#A2label"),
A3label = document.querySelector("#A3label"),
A4label = document.querySelector("#A4label"),
A5label = document.querySelector("#A5label"),
B1label = document.querySelector("#B1label"),
B2label = document.querySelector("#B2label"),
B3label = document.querySelector("#B3label"),
B4label = document.querySelector("#B4label"),
B5label = document.querySelector("#B5label"),
B6label = document.querySelector("#B6label"),
B7label = document.querySelector("#B7label"),
B8label = document.querySelector("#B8label"),
B9label = document.querySelector("#B9label"),
B10label = document.querySelector("#B10label"),
B11label = document.querySelector("#B11label"),
C1label = document.querySelector("#C1label"),
C2label = document.querySelector("#C2label"),
C3label = document.querySelector("#C3label"),
C4label = document.querySelector("#C4label"),
C5label = document.querySelector("#C5label"),
C6label = document.querySelector("#C6label"),
C7label = document.querySelector("#C7label"),
D1label = document.querySelector("#D1label"),
D2label = document.querySelector("#D2label"),
E1label = document.querySelector("#E1label"),
E2label = document.querySelector("#E2label"),
E3label = document.querySelector("#E3label"),
E4label = document.querySelector("#E4label"),
F1label = document.querySelector("#F1label"),
F2label = document.querySelector("#F2label"),
F3label = document.querySelector("#F3label"),
F4label = document.querySelector("#F4label"),
F5label = document.querySelector("#F5label"),
F6label = document.querySelector("#F6label"),
G1label = document.querySelector("#G1label"),
G2label = document.querySelector("#G2label"),
H1label = document.querySelector("#H1label"),
H2label = document.querySelector("#H2label"),
H3label = document.querySelector("#H3label"),
H4label = document.querySelector("#H4label"),
I1label = document.querySelector("#I1label"),
I2label = document.querySelector("#I2label"),
I3label = document.querySelector("#I3label"),
I4label = document.querySelector("#I4label"),
I5label = document.querySelector("#I5label"),
I6label = document.querySelector("#I6label"),
J1label = document.querySelector("#J1label"),
J2label = document.querySelector("#J2label"),
J3label = document.querySelector("#J3label"),
J4label = document.querySelector("#J4label"),
J5label = document.querySelector("#J5label"),
J6label = document.querySelector("#J6label"),
J7label = document.querySelector("#J7label"),
J8label = document.querySelector("#J8label"),
J9label = document.querySelector("#J9label"),
J10label = document.querySelector("#J10label"),
J11label = document.querySelector("#J11label"),
J12label = document.querySelector("#J12label"),
J13label = document.querySelector("#J13label"),
J14label = document.querySelector("#J14label"),
J15label = document.querySelector("#J15label"),
J16label = document.querySelector("#J16label"),
J17label = document.querySelector("#J17label"),
J18label = document.querySelector("#J18label"),
K1label = document.querySelector("#K1label"),
K2label = document.querySelector("#K2label"),
K3label = document.querySelector("#K3label"),
K4label = document.querySelector("#K4label"),
K5label = document.querySelector("#K5label"),
K6label = document.querySelector("#K6label"),
K7label = document.querySelector("#K7label"),
L1label = document.querySelector("#L1label"),
L2label = document.querySelector("#L2label"),
L3label = document.querySelector("#L3label"),
L4label = document.querySelector("#L4label"),
L5label = document.querySelector("#L5label"),
L6label = document.querySelector("#L6label"),
L7label = document.querySelector("#L7label"),
L8label = document.querySelector("#L8label"),
L9label = document.querySelector("#L9label"),
L10label = document.querySelector("#L10label"),
L11label = document.querySelector("#L11label"),
L12label = document.querySelector("#L12label"),
M1label = document.querySelector("#M1label"),
M2label = document.querySelector("#M2label");

//ADTsheets (A-1, A-2, A-3)
const A1 = document.querySelector("#A-1"),
A2 = document.querySelector("#A-2"),
A3 = document.querySelector("#A-3"),
A4 = document.querySelector("#A-4"),
A5 = document.querySelector("#A-5"),
B1 = document.querySelector("#B-1"),
B2 = document.querySelector("#B-2"),
B3 = document.querySelector("#B-3"),
B4 = document.querySelector("#B-4"),
B5 = document.querySelector("#B-5"),
B6 = document.querySelector("#B-6"),
B7 = document.querySelector("#B-7"),
B8 = document.querySelector("#B-8"),
B9 = document.querySelector("#B-9"),
B10 = document.querySelector("#B-10"),
B11 = document.querySelector("#B-11"),
C1 = document.querySelector("#C-1"),
C2 = document.querySelector("#C-2"),
C3 = document.querySelector("#C-3"),
C4 = document.querySelector("#C-4"),
C5 = document.querySelector("#C-5"),
C6 = document.querySelector("#C-6"),
C7 = document.querySelector("#C-7"),
D1 = document.querySelector("#D-1"),
D2 = document.querySelector("#D-2"),
E1 = document.querySelector("#E-1"),
E2 = document.querySelector("#E-2"),
E3 = document.querySelector("#E-3"),
E4 = document.querySelector("#E-4"),
F1 = document.querySelector("#F-1"),
F2 = document.querySelector("#F-2"),
F3 = document.querySelector("#F-3"),
F4 = document.querySelector("#F-4"),
F5 = document.querySelector("#F-5"),
F6 = document.querySelector("#F-6"),
G1 = document.querySelector("#G-1"),
G2 = document.querySelector("#G-2"),
H1 = document.querySelector("#H-1"),
H2 = document.querySelector("#H-2"),
H3 = document.querySelector("#H-3"),
H4 = document.querySelector("#H-4"),
I1 = document.querySelector("#I-1"),
I2 = document.querySelector("#I-2"),
I3 = document.querySelector("#I-3"),
I4 = document.querySelector("#I-4"),
I5 = document.querySelector("#I-5"),
I6 = document.querySelector("#I-6"),
J1 = document.querySelector("#J-1"),
J2 = document.querySelector("#J-2"),
J3 = document.querySelector("#J-3"),
J4 = document.querySelector("#J-4"),
J5 = document.querySelector("#J-5"),
J6 = document.querySelector("#J-6"),
J7 = document.querySelector("#J-7"),
J8 = document.querySelector("#J-8"),
J9 = document.querySelector("#J-9"),
J10 = document.querySelector("#J-10"),
J11 = document.querySelector("#J-11"),
J12 = document.querySelector("#J-12"),
J13 = document.querySelector("#J-13"),
J14 = document.querySelector("#J-14"),
J15 = document.querySelector("#J-15"),
J16 = document.querySelector("#J-16"),
J17 = document.querySelector("#J-17"),
J18 = document.querySelector("#J-18"),
K1 = document.querySelector("#K-1"),
K2 = document.querySelector("#K-2"),
K3 = document.querySelector("#K-3"),
K4 = document.querySelector("#K-4"),
K5 = document.querySelector("#K-5"),
K6 = document.querySelector("#K-6"),
K7 = document.querySelector("#K-7"),
L1 = document.querySelector("#L-1"),
L2 = document.querySelector("#L-2"),
L3 = document.querySelector("#L-3"),
L4 = document.querySelector("#L-4"),
L5 = document.querySelector("#L-5"),
L6 = document.querySelector("#L-6"),
L7 = document.querySelector("#L-7"),
L8 = document.querySelector("#L-8"),
L9 = document.querySelector("#L-9"),
L10 = document.querySelector("#L-10"),
L11 = document.querySelector("#L-11"),
L12 = document.querySelector("#L-12"),
M1 = document.querySelector("#M-1"),
M2 = document.querySelector("#M-2");
//Decision tree values for each subategory (A-1, A-2, A-3)
const  
//A1
  A1ACT1 = [],
  A1ACT2 = [],
  A1ACT3 = [],  
  A1DP1 = ["DP1. Signs of infection. All Soldiers with otitis media or moderate to severe otitis externa should be evaluated by a privileged provider to be considered for antibiotics."],
  A1DP2 = ["DP2. Vertigo requires an internal ear evaluation. Longer timeline and decreased hearing can be signs of a complication from an ear infection or alternate cause requiring a qualified provider evaluation."],
  A1DP3 = ["Mild otitis externa, temporal-mandibular joint (TMJ) dysfunction, and ear pain with normal exam should be treated with minor-care.","MCP for otitis externa. Soak wick of a cotton ball wick with OTC ear drops. Place in the ear for 24 hours while using the drops. Remove the cotton wick and continue drops for 1 week (3 days after the symptoms have resolved). Keep the ear canal dry. Use OTC ibuprofen as needed for pain. Return to clinic if not resolved in 1 week or worsening symptoms to include pain or fever.","MCP for TMJ is another common cause of pain around the ear. Evaluation includes seeing if the pain increases with opening and closing the jaw while placing the finger on the anterior inside of the ear to feel the joint. Ensure pain is not related to the heart. Use OTC ibuprofen for inflammation and pain. Refer to dental if history of teeth grinding. Instruct on avoidance of triggers (excessive chewing, chewing gum). Home therapy is jaw isometric exercises: jaw is open 1 inch and jaw is pushed 1) down against a loosely fisted hand and 2) forward against a hand for 5 seconds each, each set is repeated 5 times per session with 3 sessions per day. Return if not improving within three days."],
  A1DP4 = [],
  A1DPRE = ["DP3. Evaluate for cold symptoms and sore throat that can be associated with ear pain with their respective protocols."],
  A1DPRED = [],
  A1PRO = [],
  A1LIMITATIONS = [],
  A1GEN = ["pg. 19-20: A sore throat is often due to a viral infection. Bacterial infections and other causes need to also be considered."],
  A1MEDCOM = ["Obtain a Throat Culture", "pg. 68","(13)"],
  A1STP1 = ["Subject Area 6: Primary Care. Perform a head, eyes, ears, nose, and throat (HEENT) Exam. 081-833-0254", "Subject Area 6: Primary Care. Provide Care for Common Throat Infections. 081-833-0243","Subject Area 15: Primary Care (SL2). Obtain a Throat Culture. 081-833-0248"],


//A2
  A2ACT1 = [],
  A2ACT2 = [],
  A2ACT3 = [],  
  A2DP1 = ["DP1. Signs of infection. All Soldiers with otitis media or moderate to severe otitis externa should be evaluated by a privileged provider to be considered for antibiotics."],
  A2DP2 = ["DP2. Vertigo requires an internal ear evaluation. Longer timeline and decreased hearing can be signs of a complication from an ear infection or alternate cause requiring a qualified provider evaluation."],
  A2DP3 = ["Mild otitis externa, temporal-mandibular joint (TMJ) dysfunction, and ear pain with normal exam should be treated with minor-care.","MCP for otitis externa. Soak wick of a cotton ball wick with OTC ear drops. Place in the ear for 24 hours while using the drops. Remove the cotton wick and continue drops for 1 week (3 days after the symptoms have resolved). Keep the ear canal dry. Use OTC ibuprofen as needed for pain. Return to clinic if not resolved in 1 week or worsening symptoms to include pain or fever.","MCP for TMJ is another common cause of pain around the ear. Evaluation includes seeing if the pain increases with opening and closing the jaw while placing the finger on the anterior inside of the ear to feel the joint. Ensure pain is not related to the heart. Use OTC ibuprofen for inflammation and pain. Refer to dental if history of teeth grinding. Instruct on avoidance of triggers (excessive chewing, chewing gum). Home therapy is jaw isometric exercises: jaw is open 1 inch and jaw is pushed 1) down against a loosely fisted hand and 2) forward against a hand for 5 seconds each, each set is repeated 5 times per session with 3 sessions per day. Return if not improving within three days."],
  A2DP4 = [],
  A2DPRE = ["DP3. Evaluate for cold symptoms and sore throat that can be associated with ear pain with their respective protocols."],
  A2DPRED = [],
  A2PRO = ["MCP for Mild Otitis Externa: Soak wick of a cotton ball with ear drops. Place in the ear for 24 hours while using the drops. Remove the cotton wick and continue drops for 1 week (3 days after the symptoms have resolved). Keep the ear canal dry","MCP for TMJ: Refer to dental if history of teeth grinding, ibuprofen as needed for pain, instruct on avoidance of triggers and home jaw exercises.","Return if not improving in 3 days, worsening symptoms, dizziness, loss of hearing, stiff neck."],
  A2LIMITATIONS = ["Otitis Externa: Avoidance of situations requiring utilization of ear plugs, No swimming","Eustachian Tube Dysfunction: No scuba diving"],
  A2GEN = ["pg 21-22"],
  A2MEDCOM = ["Administer Otic Medications pg.67 (3)(b)"],
  A2STP1 = ["Subject Area 6: Primary Care. Perform a HEENT Exam. 081-833-0254"," Subject Area 6: Primary Care. Provide Treatment for Common Ear Infections. 081-833-0241 ","Subject Area 18: Medication Administration. Administer Ear Medications. 081-833-0020"],


//A3
  A3ACT1 = ["Place Mask"],
  A3ACT2 = ["Place Mask"],
  A3ACT3 = [],
  A3DP1 = ["Soldier with an ongoing productive cough may be contagious and needs to be evaluated for quarters.", "Viral symptoms that are improving and then get worse or onset of severe pain over the cheekbones/back upper teeth (sinuses) can be a sign of a sinus problem requiring prescription medications."],
  A3DP2 = ["Purulent material is thick, yellow/greenish, foul smelling nasal discharge. Purulent discharge can be a sign of an infection or a retained foreign body in the nose.", "If symptoms have been going on for over seven days, evaluate for a bacterial infection."],
  A3DP3 = ["Most upper respiratory tract infection symptoms which include sore throat and ear pain are caused by a virus or allergies and do not require antibiotics. Minor-care is focused on improving the symptoms that the Soldier is having while the issue resolves on its own.","MCP Cold: Counsel the Soldier to drink plenty of fluids and rest, cover their mouth when they cough and wash hands to prevent spread.","Ibuprofen for pain, acetaminophen for elevated temperature, decongestant for nasal congestion, guaifenesin for mucous, or antihistamine for allergies","Return to clinic if not improving within 1 week, worsening symptoms, fever, new sinus pain, lightheadedness, or pain in the neck."],
  A3DP4 = [],
  A3DPRE = [],
  A3DPRED = ["Red Flags: If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”","Shortness of breath and abnormal pulse oxygenation suggest respiratory compromise. The soldier should be immediately started on oxygen pending further evaluation.", "Fever with a stiff neck suggests meningitis.", "Quick Sequential (sepsis-related) Organ Failure Assessment (qSOFA) is comprised of a respiratory rate greater than 21, systolic blood pressure less than 101, and Glasgow coma scale less than 15.", "Coughing up blood clots or quarter sized amounts of blood can be a sign of bleeding within the lungs."],
  A3PRO = ["MCP for Cold: Counsel the Soldier to drink plenty of fluids, get plenty of rest, and to cover their mouth when coughing and wash their hands to prevent spread.","Stop or limit smoking.","Ibuprofen for pain, Acetaminophen for elevated temperature, decongestant for nasal congestion, guaifenesin for mucous, or antihistamine for allergies","Return if it does not improve in 7 days, worsening symptoms, develop sinus pain, lightheaded, neck pain, or fever."],
  A3LIMITATIONS = ["Consider quarters/ contagious precautions while febrile"],
  A3GEN = ["pg. 23-24: If a Soldier states that they have a cold, determine what complaint to screen by asking, “What do you mean by a cold?” If his/her complaint can be screened by another protocol, use that protocol."],
  A3MEDCOM = ["Administer Antihistamines pg.67 (3)(j)","Administer Allergy Shots/Skin Testing pg.67 (2)","Provide Oxygen pg.69 (2)(h)"],
  A3STP1 = ["Subject Area 6: Primary Care. Perform a HEENT Exam. 081-833-0254","Subject Area 6: Primary Care. Provide Treatment for Sinus Infections. 081-833-0242","Subject Area 6: Primary Care. Provide Care for Common Throat Infections. 081-833-0243","Subject Area 6: Primary Care. Provide Care for Common Respiratory Disorders. 081-833-0245"],

//A4 
  A4ACT1 = ["Ear irrigation if wax and TM intact"],
  A4ACT2 = [],
  A4ACT3 = [],
  A4DP1 = ["DP1. Ringing greater than 24 hours or related to an event requires further evaluation. Vertigo or “room-spinning dizziness” can be a symptom of inner ear problems and is often associated with nausea. Distinguish vertigo from light-headedness which is screened separately."],
  A4DP2 = ["DP2. Trauma and blast injuries can result in Tympanic Membrane or inner ear problems. Foreign body or excessive wax within the ear canal can result in reversible hearing loss. If excessive wax is present, discuss removal with supervisor."],
  A4DP3 = ["MCP. Tinnitus due to recent noise exposure should show improvement over the next 24 hours. Stress the importance of utilizing correct fitting hearing protection. Instruct the Soldier to return for medical assistance if ringing does not improve or if dizziness, ear pain, or hearing loss develops. Temporary sensation of hearing loss can be due to colds or ear infections. Soldiers with upper respiratory infection symptoms should be screened according to those protocols."],
  A4DP4 = [],
  A4DPRE = ["DP3. If the ringing noise is an associated symptom of a cold or flu, it should be screened by the protocol that addresses that primary complaint. Ringing in the ears, if without loss of balance, is not uncommon especially following recent exposure to loud noises from situations such as weapons firing or riding in mechanized vehicles or aircraft. Generally, the ringing in the ears associated with such noises subsides within 24 hours, but may persist in persons who have long histories of exposure. Further examination is indicated in the absence of exposure to excessive noise or for symptoms lasting longer than 24 hours. Ringing in the ears, if without loss of balance, can be associated with certain medications such as aspirin, nonsteroidal anti-inflammatory agents, some diuretics, etc. It is also important to check for hearing on the follow-up visit."],
  A4DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Altered mental status is a sign of a more serious underlying problem. Ear trauma can also result in a concussion that needs to be evaluated further. Focal neurological symptom/sign require further evaluation."],
  A4PRO = ["Ringing sound after exposure to excessive noise exposure should resolve within 24 hours","Return to clinic if the ringing does not resolve after 24 hours.","Return if associated with dizziness (spinning sensation) or worsening symptoms"],
  A4LIMITATIONS = ["Avoid loud noise exposure"],
  A4GEN = ["pg. 25-26"],
  A4MEDCOM = ["Administer Otic Medications pg.67 (3)(b) "],
  A4STP1 = ["Subject Area 6: Primary Care. Perform a HEENT Exam. 081-833-0254","Subject Area 6: Primary Care. Provide Treatment for Common Ear Infections. 081-833-0241","Subject Area 15: Primary Care. Irrigate an Obstructed Ear. 081-833-0059 ","Subject Area 18: Medication Administration. Administer Ear Medications. 081-833-0020"],
  
//A5
  A5ACT1 = [],
  A5ACT2 = [],
  A5ACT3 = [],
  A5DP1 = ["DP2. Soldiers who have had trauma to the nose with an associated nosebleed require further screening. ","A misaligned broken nose can affect the upper airway and increase the risk of future sinus infections. Other injuries can be associated with the force that caused the trauma and nosebleed. ","Nosebleed while on anticoagulants can make it more difficult to stop a nosebleed and be a sign that the anticoagulation level is too high. ","Purulent discharge can be related to a retained foreign body or a concurrent infection that requires additional treatment. ","Recurrent nosebleeds not associated with a cold can be a sign of a bleeding disorder."],
  A5DP2 = ["DP3. Cold symptoms often result in nosebleeds from recurrent blowing of the nose, rubbing the nose with a tissue after blowing it, picking the nose from congestion, and prominent blood vessels from allergies or inflammation. ","Soldiers with symptoms of runny nose, congestion, or allergies should be screened with the cold symptoms protocol."],
  A5DP3 = ["MCP Nosebleed. Once the bleeding is controlled, tell the Soldier to avoid vigorous blowing of the nose. If the room air is dry a humidifier or vaporizer often helps. Instruct the Soldier to return for medical assistance if the bleeding recurs and is not able to be controlled with tilting the head forward and applying external pressure with the thumb and index finger for 5 minutes or if the amount of blood lost at one time is enough to soak a wash cloth (ask the Soldier to bring in his wash cloth). ","Saline nasal spray can be used to prevent future nosebleeds if the air is dry after the initial nosebleed has resolved. ","Decongestant (Oxymetazoline) can be used to constrict the blood vessels."],
  A5DP4 = [],
  A5DPRE = [],
  A5DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Orthostatic hypotension is a sign of volume depletion and can represent a significant amount of blood loss.","Action1. Nosebleeds normally result from the rupture of small blood vessels inside the nose related to mucosal trauma (nose picking) or irritation (dry climate, blowing nose). 90% occur in the front of septum in the nose and can be controlled by applying external pressure.","If the bleeding does not stop, then the nosebleed likely is coming from the back of the nose and needs to be controlled by a privileged provider."],
  A5PRO = ["Do not blow the nose vigorously or wipe the middle of the nose, as it can cause a nosebleed.","Medications: nasal saline for prevention if the air is dry, oxymetazoline if recurrent with nasal sx.","Humidifier can also be used if the air is dry.","Return if unable to get a recurrent nosevleed to stop, notice bleeding from other sites, feeling lightheaded or tired, losing a significant amount of blood, or recurrent without common cold sx."],
  A5LIMITATIONS = [],
  A5GEN = ["pg. 27-28: Nosebleeds normally result from the rupture of small blood vessels inside the nose related to mucosal trauma (nose picking) or irritation (dry climate, blowing nose). 90% occur in the front of septum in the nose and can be controlled by applying external pressure. If the bleeding does not stop, then the nosebleed likely is coming from the back of the nose and needs to be controlled by a privileged provider."],
  A5MEDCOM = ["N/A"],
  A5STP1 = ["Subject Area 6: Primary Care. Perform a HEENT Exam. 081-833-0254"],
  
//B1
  B1ACT1 = [],
  B1ACT2 = [],
  B1ACT3 = [],
  B1DP1 = ["If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”","Back pain associated with pain, numbness, or tingling running down into the legs may represent central or peripheral nerve impingement and requires further evaluation.", "Refer to a physical therapist if direct referral is available locally"],
  B1DP2 = ["MCP Low back pain (LBP). LBP is extremely common in Soldiers. The best treatment is conservative measures including a home exercise program for mobilization and strengthening, ice and heat as needed for inflammation, and pain control with analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Follow established local protocols for home exercise that focus on stretching the lower back and hamstrings multiple times per day, strengthening the core muscles daily, and pain control as needed. Often obesity is a factor in low back pain and Soldiers should be encouraged to lose weight. Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, worsening of other symptoms, symptoms last longer than one week. If direct access to physical therapy (physical therapy sick call) is available, consider direct referral to physical therapy in accordance with local policy."],
  B1DP3 = [],
  B1DP4 = [],
  B1DPRE = [],
  B1DPRED = ["If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”"],
  B1PRO = ["Provide home exercise program, activity modification as appropriate","Intermittent ice or heat IAW local protocol for inflammation","Medication: analgesic balm for mild pain, Ibuprofen (1st line) and Ketorolac (2nd line) for moderate pain as needed","Refer to PT if direct access is available","Follow-up: Immediate follow-up for a DP1 or DP2 symptoms. Routine follow-up is recommended for any symptoms that do not improve or worsen"],
  B1LIMITATIONS = ["No repetitive bending or lifting but may lift/ carry up to 40lbs", "Perform stretching, core strengthening home regiment during PT", "No ruck marching, running, or jumping but may walk, bike, or swim for cardio"],
  B1GEN = ["pg. 29-30: A focused history and physical exam is essential to localizing a Soldier’s complaint of back pain and identifying its source. The HPI should include an OPQRST evaluation of the complaint and the ROS should specifically address red flag symptoms as well as questions related but not limited to infection, trauma, cardiopulmonary, gastrointestinal, and genitourinary, or gynecological complaints."],
  B1MEDCOM = ["Initial Management of Fractures/Spinal Injury. pg.69 (2)(d)"],
  B1STP1 = ["Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222"],

//B2
  B2ACT1 = ["Immobilize head and neck if associated with trauma.","Support ABCs as required."],
  B2ACT2 = [],
  B2ACT3 = [],
  B2DP1 = ["Bony step off and midline tenderness can be signs of a vertebral fracture.","Inability to flex the neck can be a sign of meningitis or fracture. ","Recent head, eyes, ears, nose, and throat (HEENT) or dental infection can have progressed to a more serious infection. ","Action 1. In the setting of trauma, immobilize the head and neck and support ABCs as required, then transfer care to a privileged provider."],
  B2DP2 = ["DP2. Neck pain associated with pain, numbness, or tingling running down into the shoulder or arms may represent central or peripheral nerve impingement and requires further evaluation.", "Refer to physical therapy if direct referral is available locally."],
  B2DP3 = ["MCP. Neck pain is extremely common in Soldiers. ","The best treatment is conservative measures including a home exercise program for mobilization and strengthening, ice and heat as needed for inflammation, and pain as needed. ","A temporary profile may be required. ","Instruct the Soldier to work the neck through its range of motion at least twice each day to preserve mobility. This should ideally be done after a 20-minute application of ice. ","The range of motion exercise should not be vigorous enough to cause pain. ","Follow established local protocols for home exercise. ","Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. ","Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, worsening of other symptoms, symptoms last longer than one week. If direct access to physical therapy (physical therapy sick call) is available,"],
  B2DP4 = [],
  B2DPRE = [],
  B2DPRED = ["Bony step off and midline tenderness can be signs of a vertebral fracture.","Inability to flex the neck can be a sign of meningitis or fracture. ","Recent head, eyes, ears, nose, and throat (HEENT) or dental infection can have progressed to a more serious infection. ","Action 1. In the setting of trauma, immobilize the head and neck and support ABCs as required, then transfer care to a privileged provider."],
  B2PRO = ["Provide home exercise program. Activity modification as appropriate.","Intermittent ice or heat as needed for inflammation.","Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed.","Refer to PT if direct access is available.","Follow-up: Immediate follow-up for a DP1 or DP2 symptoms. ","Routine follow-up is recommended for any symptoms that do not improve or worsen"],
  B2LIMITATIONS = ["No rucking or jumping","Consider limiting Kevlar use","Restrict driving if limited ROM","Perform stretching, core strengthening home regiment during PT"],
  B2GEN = ["pg. "],
  B2MEDCOM = [""],
  B2STP1 = [""],
  
//B3
  B3ACT1 = ["Immobilize the injured extremity before transport or referral"],
  B3ACT2 = ["Immobilize the injured extremity before transport or referral"],
  B3ACT3 = [],
  B3DP1 = ["DP 1. The red flags indicate a medical emergency. ","Immobilize the affected extremity prior to transport if associated with trauma. ","Immediately refer shoulder pain associated with cardiac symptoms (sweating, shortness of breath, chest or jaw pain/ pressure).","A red, warm, swollen joint or pain with fever can be a sign of an infected joint requiring immediate surgical evaluation. ","Abdominal symptoms suggest an extrinsic cause requiring evaluation"],
  B3DP2 = ["DP2. Neurologic symptoms (numbness, weakness) suggest nerve impingement. ","Limited motion suggests a more significant injury that should be placed in a sling and require further evaluation. ","Laceration may require closure."],
  B3DP3 = ["for mobilization and strengthening and analgesics as needed. A temporary profile may be required. Instruct the Soldier to work the injured shoulder through its range of motion (but not vigorous enough to cause pain) at least twice each day to preserve mobility after a 20-minute application of ice. Follow established local protocols for home exercise. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, worsening of other symptoms, symptoms last longer than one week. Refer to PT if direct access to physical therapy (physical therapy sick call) is available, in accordance with local policy."],
  B3DP4 = [],
  B3DPRE = [],
  B3DPRED = ["Red Flags: If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” ","Abnormal distal pulse or sensation in the setting of trauma is a medical emergency require immediate evaluation. ","Deformity can be a dislocated shoulder or fracture. ","Myocardial infarction can be associated with shoulder pain."],
  B3PRO = ["Provide home exercise program. Activity modification as appropriate","Intermittent ice or heat for inflammation","Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed","Refer to PT if direct access is available","Follow-up: Immediate follow-up for a DP1 or DP2 symptoms. Routine follow-up is recommended for any symptoms that do not improve or worsen."],
  B3LIMITATIONS = ["May lift, push, pull up to 5 lbs","No overhead lifting or repetitive activities","Perform stretching, core strengthening home regiment during PT"],
  B3GEN = ["Pg. 33-34: Anterolateral shoulder pain worsened by reaching overhead can be related to impingement syndrome, AC joint pathology, or rotator cuff injury. Posterior shoulder pain could be from rotator cuff injury, gallbladder, spleen, or neck."],
  B3MEDCOM = ["Initial Management of Fractures/Spinal Injury. pg.69 (2)(d)"],
  B3STP1 = ["Subject Area 7: Musculoskeletal. Perform an Examination of the Shoulder. 081-833-0269", "Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222"],


//B4
  B4ACT1 = ["Immobilize the injured extremity before transport or referral"],
  B4ACT2 = [],
  B4ACT3 = [],
  B4DP1 = ["DP 1: Immobilize the affected extremity prior to transport if associated with trauma. A red, warm, swollen joint or pain with fever can be a sign of an infected joint requiring immediate surgical evaluation. Diffuse pain that involves multiple joints or muscles may represent a systemic cause and requires further evaluation.","DP2: Limited ROM and swelling may represent an issue within the joint requiring further evaluation. Neck and shoulder issues may refer pain to the elbow. Ulnar nerve pain may be referred to the ulnar side of the forearm, hand, pinky, and ring finger area."],
  B4DP2 = ["MCP. The best treatment is conservative measures including a home exercise program for mobilization and strengthening and analgesics as needed. ","A temporary profile may be required. ","Instruct the Soldier to work the injured elbow through its range of motion at least twice each day to preserve mobility. This should ideally be done after a 20-minute application of ice. ","The range of motion exercise should not be vigorous enough to cause pain. Follow established local protocols for home exercise. ","Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. ","Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, worsening of other symptoms, symptoms last longer than one week. ","If direct access to physical therapy (physical therapy sick call) is available, consider direct referral to physical therapy in accordance with local policy."],
  B4DP3 = [],
  B4DP4 = [],
  B4DPRE = [],
  B4DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” ","Abnormal distal pulse or sensation in the setting of trauma is a medical emergency requiring immediate evaluation."],
  B4PRO = ["Provide home exercise program. Activity modification as appropriate","Intermittent ice or heat for inflammation","Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed","Refer to PT if direct access is available","Follow-up: Immediate follow-up for a DP1 or DP2 symptoms. Routine follow-up is recommended for any symptoms that do not improve or worsen."],
  B4LIMITATIONS = ["May lift, push, pull up to 5 lbs","No repetitive bending of elbow or turning/ bending of wrist","Perform stretching, core strengthening home regiment during PT"],
  B4GEN = ["Pg. 35-36: Elbow joint is formed by the connection of the distal humerus and the proximal radius (radial head). Epicondyles are bony prominences on the medial and lateral side of the distal humerus and are the site tendon attachment for muscles of the lower arm. Lateral elbow pain may represent tennis elbow, radiohumeral joint pain, or referred pain."],
  B4MEDCOM = ["Initial Management of Fractures/Spinal Injury. pg.69 (2)(d)"],
  B4STP1 = ["Subject Area 7: Musculoskeletal. Perform an Examination of the Elbow. 081-833-0270","Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222"],

//B5
  B5ACT1 = ["Immobilize the injured extremity before transport or referral"],
  B5ACT2 = [],
  B5ACT3 = [],
  B5DP1 = ["DP2. Index finger or thumb numbness, pain, or weakness are symptoms of carpal tunnel syndrome. Clicking or popping with pain can be a sign of tendon instability. Ganglion is a mobile mass over a tendon that can be referred for drainage and treatment."],
  B5DP2 = ["MCP. The best treatment is conservative measures including a home exercise program for mobilization and strengthening and analgesics as needed. Instruct the Soldier to work the injured wrist through its range of motion (but not vigorous enough to cause pain) at least twice each day to preserve mobility after a 20-minute application of ice. Follow established local protocols for home exercise. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, worsening of other symptoms, symptoms last longer than one week.","If direct access to physical therapy (physical therapy sick call) is available, consider direct referral to physical therapy in accordance with local policy."],
  B5DP3 = [],
  B5DP4 = [],
  B5DPRE = [],
  B5DPRED = ["Red Flags: If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” ","Abnormal distal pulse or sensation in the setting of trauma is a medical emergency requiring immediate evaluation.","DP 1: In the setting of trauma, the red flags are an indicator of a medical emergency. Immobilize the affected extremity prior to transport. A red, warm, swollen joint or pain with fever can be a sign of an infected joint requiring immediate surgical evaluation. Trauma and Pain without recent trauma or overuse injury may represent a systemic problem to include rheumatoid arthritis or Lyme disease."],
  B5PRO = ["Provide home exercise program. Activity modification as appropriate","Intermittent ice or heat for inflammation","Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed","Refer to PT if direct access is available","Follow-up: Immediate follow-up for a DP1 or DP2 symptoms. Routine follow-up is recommended for any symptoms that do not improve or worsen."],
  B5LIMITATIONS = ["May lift, push, pull up to 5 lbs","May wrap or wear a brace for comfort","No repetitive bending of wrist","Perform stretching, core strengthening home regiment during PT"],
  B5GEN = ["Pg. 37-38: Wrist pain usually occurs from trauma or overuse. Falling on an outstretched hand can result in a scaphoid (falling forward) or lunate/ triquetrum (falling back) injury. Ulnar side of wrist may involve tendinopathy, triangular fibrocartilage complex injury, or fracture. Radial side of wrist may involve tendinopathy, ligamentous injury, or fracture. Dorsal pain may involve a wrist sprain or fracture. Volar pain may involve fracture, ganglion, or carpal tunnel syndrome."],
  B5MEDCOM = ["Initial Management of Fractures/Spinal Injury. pg.69 (2)(d)"],
  B5STP1 = ["Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222","Subject Area 7: Musculoskeletal. Perform an Examination of the Wrist. 081-833-0273"],


//B6
  B6ACT1 = ["Immobilize or wrap the injured extremity before transport"],
  B6ACT2 = [],
  B6ACT3 = [],
  B6DP1 = ["DP2. Finger catching or locking during flexion may represent trigger finger. Ulcers can represent herpetic whitlow (herpes infection). Lacerations and abscesses require further evaluation."],
  B6DP2 = ["MCP for Paronychia: Instruct the Soldier to soak the finger in warm water for 10-15 minutes three times per day and apply topical antibiotic cream after each soak. Ibuprofen (1st line) or acetaminophen (2nd line) can be provided as needed for pain. Ketorolac (3rd line) can be used once on presentation if needed for moderate pain. Return if worsening, increasing redness, abscess formation, not improving in two days.","MCP for Sprained Finger: Anatomically splint the finger to the adjacent finger with tape. Instruct the Soldier on activity modification as appropriate. Instruct the Soldier on the intermittent use of ice for swelling, ibuprofen (1st line) or acetaminophen (2nd line) as needed for pain. Ketorolac (3rd line) can be used once on presentation if needed for moderate pain. Return to clinic if the symptoms are getting worse, pain becomes severe enough to prevent performance of normal duties/activities, or improvement is not seen within one week."],
  B6DP3 = [],
  B6DP4 = [],
  B6DPRE = [],
  B6DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Abnormal distal pulse or sensation in the setting of trauma is a medical emergency requiring immediate evaluation. Significant burns of the hands are considered high risk and should be evaluated for referral to a burn center.","DP 1. The red flags are an indication of a medical emergency. In the setting of trauma, immobilize the affected extremity prior to transport. Crush injuries and history of punching something are common causes of fractures requiring further evaluation."],
  B6PRO = ["Paronychia: 10-15min warm soaks 3 times per day and topical antibiotic cream after each soak. Ibuprofen (1st line) or acetaminophen (2nd line) as needed for pain. Ketorolac (3rd line) can be used once on presentation for moderate pain. Return if worsening, spreading redness, abscess formation, not improving in 2 days.","Sprained finger: Activity modification as appropriate, Intermittent ice for swelling, ibuprofen (1st line) or acetaminophen (2nd line) as needed for pain. Splint to adjacent finger. Return if worsening or not improving."],
  B6LIMITATIONS = ["Paronychia: Keep area clean and dry","Sprained Finger: May Lift, push, pull up to 5 lbs. May tape or brace comfort. No contact sports"],
  B6GEN = ["Pg. 39-40: Any deviation of the hand from normal function can result in significant disability. Hand and finger injury are common in Soldiers."],
  B6MEDCOM = ["Initial Management of Fractures/Spinal Injury. pg.69 (2)(d)"],
  B6STP1 = ["Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222","Subject Area 7: Musculoskeletal. Apply a Rigid Splint. 081-833-0263","Subject Area 7: Musculoskeletal. Apply an Elastic Bandage. 081-833-0264"],
//B7
  B7ACT1 = ["Immobilize the hip or femur as indicated if associated with trauma.","Stress injury: crutches (toe touch)"],
  B7ACT2 = [],
  B7ACT3 = [],
  B7DP1 = ["DP2. Lateral hip pain with paresthesia is the classic presentation for lateral femoral cutaneous nerve entrapment. Abdominal pathology, testicular pathology, inguinal hernia may present with anterior hip pain that is not worse with palpation, flexion, or weight bearing."],
  B7DP2 = ["MCP for Hip Pain. The best treatment is conservative measures including a home exercise program for mobilization and strengthening and analgesics as needed. Instruct the Soldier to work the injured wrist through its range of motion (but not vigorous enough to cause pain) at least twice each day to preserve mobility after a 20-minute application of ice. Follow established local protocols for home exercise. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, pain with weight bearing or exercise develops, worsening of symptoms, symptoms last longer than 3 days.","If direct access to physical therapy (physical therapy sick call) is available, consider direct referral to physical therapy in accordance with local policy."],
  B7DP3 = [],
  B7DP4 = [],
  B7DPRE = [],
  B7DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Abnormal distal pulse or sensation in the setting of trauma is a medical emergency requiring immediate evaluation.","DP1. Significant force of trauma to include car accident can cause a hip fracture. Immobilize the affected extremity prior to transport. Pain with weight bearing or starts after a certain point during exercise can be a sign of a stress injury. Increase in exercise, long endurance training, or recent modification to training can be risk factors of a stress injury. Place the Soldier on crutches with toe touch weight bearing until a bone stress injury is ruled out."],
  B7PRO = ["Provide home exercise program. Activity modification as appropriate","Intermittent ice or heat for inflammation","Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed","Refer to PT if direct access is available"],
  B7LIMITATIONS = ["No running, jumping but may walk up to ¼ mile at own pace/ distance and stand up to 20min","May Lift, carry, push, pull up to 25 lbs","No repetitive lifting from floor","Perform stretching, core strengthening home regiment during PT"],
  B7GEN = ["pg. 41-42: Lateral pain worse with direct pressure may represent trochanteric bursitis. Anterior hip or groin pain may represent the hip joint injury, fracture (stress fracture), or non-hip issue like inguinal hernia. Femoral stress fractures are more common in initial entry training. They can result in permanent disability if not properly identified and treated."],
  B7MEDCOM = ["Initial Management of Fractures/Spinal Injury. pg.69 (2)(d)"],
  B7STP1 = ["Subject Area 7: Musculoskeletal. Perform an Examination of the Hip. 081-833-0274","Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222","Subject Area 7: Musculoskeletal. Immobilize the Pelvis. 081-833-0266"],

//B8
  B8ACT1 = ["Immobilize the injured extremity before transport"],
  B8ACT2 = [],
  B8ACT3 = [],
  B8DP1 = ["DP2. Swelling, decreased range of motion, and a previous knee injury increases the likelihood of a more significant injury like a knee injury reoccurrence or complication of the prior injury."],
  B8DP2 = ["MCP for Knee Pain. The best treatment is conservative measures including a home exercise program for mobilization and strengthening and analgesics as needed. Instruct the Soldier to work the injured knee through its range of motion (but not vigorous enough to cause pain) three times a day to preserve mobility after a 20-minute application of ice. Follow established local protocols for home exercise. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, worsening of symptoms, knee catches/ locks up or gives out, or symptoms last longer than a week.","If direct access to physical therapy (physical therapy sick call) is available, consider direct referral to physical therapy in accordance with local policy."],
  B8DP3 = [],
  B8DP4 = [],
  B8DPRE = [],
  B8DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”","DP 1. In the setting of trauma, deformity with loss of peripheral pulses or sensation is an indication of a medical emergency. High energy trauma to include car accident, skiing injury, or fall from a height should be assumed to have a serious injury until ruled out. Immobilize the affected extremity prior to transport. Red, warm joint could represent inflammation or infection. Swelling immediately after a traumatic event can be a sign of bleeding into the knee joint. Closer the pain and swelling are related to the traumatic event, the more likely there is a significant injury. Lack of an identifiable cause or relation to activity suggests an inflammatory cause that requires further evaluation."],
  B8PRO = ["Provide home exercise program. Activity modification as appropriate","Intermittent ice or heat for inflammation","Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed","Refer to PT if direct access is available","Follow-up: Immediate follow-up for a DP1 or DP2 symptoms. Routine follow-up is recommended for any symptoms that do not improve or worsen."],
  B8LIMITATIONS = ["No running, jumping but may walk up to 1/4 mile at own pace/distance and stand up to 15min","No repetitive squatting but may lift, carry, push, pull up to 25 lbs","Perform stretching, core strengthening home regiment during PT","May wear a brace or wrap"],
  B8GEN = ["pg. 43-44: Knee pain is a common complaint in Soldiers with a complex differential that includes evaluating for trauma, overuse, swelling, and referred pain."],
  B8MEDCOM = ["Initial Management of Fractures/Spinal Injury. pg.69 (2)(d)"],
  B8STP1 = ["Subject Area 7: Musculoskeletal. Perform an Examination of the Knee. 081-833-0268","Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222","Subject Area 7: Musculoskeletal. Apply a Rigid Splint. 081-833-0263","Subject Area 7: Musculoskeletal. Apply an Elastic Bandage. 081-833-0264"],

  B9ACT1 = ["Immobilize the injured extremity before transport"],
  B9ACT2 = ["X-ray, crutches, and PT education"],
  B9ACT3 = [],
  B9DP1 = ["DP 2. Ottawa rules are a way of screening for the likelihood of a fracture associated with an ankle sprain. Inability to bear weight after and take 4 steps, tenderness over the posterior tip of the medial or lateral malleolus, or tenderness at the proximal metatarsal are signs of a potential fracture. Squeeze test evaluates for syndesmotic sprain by compressing the fibula against the tibia at the mid-calf."],
  B9DP2 = ["MCP for Ankle Pain. The best treatment is conservative measures including a home exercise program for mobilization and strengthening and analgesics as needed. Instruct the Soldier to work the injured ankle through its range of motion at least three times each day to increase mobility. This should ideally be done after a 20-minute application of ice. The range of motion exercise should not be vigorous enough to cause pain. Follow established local protocols for home exercise. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Instruct the Soldier to seek medical assistance if pain becomes severe enough as to prevent performance of normal duties/activities, worsening, not improving within one week.","If direct access to physical therapy (physical therapy sick call) is available, consider direct referral to physical therapy in accordance with local policy."],
  B9DP3 = [],
  B9DP4 = [],
  B9DPRE = [],
  B9DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”","DP 1. In the setting of trauma, deformity with loss of peripheral pulses or sensation is an indication of a medical emergency. Immobilize the affected extremity prior to transport. If posterior ankle pain, have the Soldier lie on his or her stomach and squeeze the calf. The test is positive if the foot does not plantar flex with squeezing the calf indicative of a possible Achilles tendon rupture. Pain unrelated to overuse or injury could be an inflammatory process requiring further evaluation."],
  B9PRO = ["Provide home exercise program, wrap the ankle, and activity modification as appropriate","Intermittent ice for inflammation. Elevate for swelling","Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed","Refer to PT if direct access is available","Follow-up: Immediate follow-up for a DP1 or DP2 symptoms. Return to clinic if worsening or not improving within 1 week."],
  B9LIMITATIONS = ["No running, jumping, rucking but may walk up to ¼ mile at own pace/ distance and stand up to 20min","May Lift, carry, up to 25 lbs","Limit walking over uneven terraine","Perform stretching, strengthening home regiment during PT","May wear brace or wrap"],
  B9GEN = ["pg 45-46: Ankle pain is a common complaint in Soldiers from overuse or trauma."],
  B9MEDCOM = ["Initial Management of Fractures/Spinal Injury pg.69 (2)(d) "],
  B9STP1 = ["Subject Area 7: Musculoskeletal. Perform an Examination of the Ankle. 081-833-0272 ","Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222","Subject Area 7: Musculoskeletal. Apply a Rigid Splint. 081-833-0263 ","Subject Area 7: Musculoskeletal. Apply an Elastic Bandage. 081-833-0264"],

  B10ACT1 = ["Immobilize the injured extremity before transport.","Stress injury: crutches (toe touch)"],
  B10ACT2 = [],
  B10ACT3 = [],
  B10DP1 = ["DP 2. Numbness is often a sign of nerve compression. Refer to PT if direct access is available. Red, warm, and abscess can be signs of infection requiring further evaluation and treatment."],
  B10DP2 = ["MCP for ingrown toenail. Soak in antibacterial soap and water for 20min three times per day. Place cotton under the nail to push it way from the affected lateral nail fold. Consult the supervising privileged provider for toenail removal evaluation (J-18) if moderate to severe.","MCP for subungual hematoma. After discussion and concurrence by supervisor, treat by puncturing the nail allowing for trapped blood and pressure to be relieved. Keep the affected toe clean. Soak it in antibacterial soap and water twice a day for 3 days.","MCP for plantar fasciitis or foot pain. Home exercise program (stretch, strengthen) and icing of the affected arch. Arch support may assist in preventing recurrence.","MCP for blisters, callus (see J-15). Use moleskin and activity modification.","MCP for plantar wart (see J-16). Discuss with your supervising NCO.","All MCPs for feet Issues. Medication: ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed. Instruct the Soldier to seek medical assistance if symptoms worsen, pain becomes severe enough as to prevent performance of normal duties/activities, not improving within one week of minor-care."],
  B10DP3 = [],
  B10DP4 = [],
  B10DPRE = [],
  B10DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”","DP 1. In the setting of trauma, deformity with loss of peripheral pulses or sensation is an indication of a medical emergency. Immobilize the affected extremity prior to transport. Constant pain can be a sign of a more serious injury. Unrelated to overuse or injury can be a sign of inflammation requiring further evaluation."],
  B10PRO = ["Ingrown Toenail: Soak in soap and water for 20min three times per day. Place cotton under the toenail. Consult provider if toenail removal required (protocol J-18)","Subungual Hematoma: Discuss with supervisor. Treat. Soak in soap and water twice a day for 3 days.","Plantar fasciitis: Home exercise/ stretching program, intermittent ice for inflammation, ibuprofen as needed for pain. Consider activity modification and arch support. Refer to PT if direct access is available","Blisters, Callus (See J-15). Use moleskin. Consider activity modification","Plantar Wart (See J-16). Discuss with supervising provider.","Return to clinif if worsens, new symptoms develop, or not improving within 1 week or interferes with performance of normal duties/ activities."],
  B10LIMITATIONS = ["No running, jumping, rucking but may walk up to ¼ mile at own pace/ distance and stand up to 20min","May Lift, carry, up to 25 lbs","Perform stretching, strengthening home regiment during PT"],
  B10GEN = ["pg. 47-48: Common anterior foot pains include around the big toe (bunion, sprain, arthritis, sesamoiditis, ingrown toenail, subungual hematoma) and below the 2nd and 3rd metatarsals (metatarsalgia, Morton’s neuroma, and plantar wart)."],
  B10MEDCOM = ["Initial Management of Fractures/Spinal Injury pg.69 (2)(d)"],
  B10STP1 = ["Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal. Disorders. 081-833-0222 ","Subject Area 7: Musculoskeletal. Apply a Rigid Splint. 081-833-0263 ","Subject Area 7: Musculoskeletal. Apply and Elastic Bandage. 081-833-0264"],

  B11ACT1 = ["Immobilize the injured extremity.","Start IV for suspected rhabdomyolysis","Crutches for suspected BSI"],
  B11ACT2 = ["Provide crutch if needed"],
  B11ACT3 = [],
  B11DP1 = ["DP 2. Limited motion or loss of strength can be a sign of a muscle tear or rupture. Laceration needs to be evaluated for possible closure."],
  B11DP2 = ["MCP for overuse injuries. Exercise modification should be done to limit the use of the area that is involved. Instruct the Soldier to stretch the injured area for at least a minute 4 times per day. Home exercise program can be used to strengthen the area. Follow established local protocols for home exercise. Intermittent ice and heat can be used for inflammation. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Instruct the Soldier to seek medical assistance if pain becomes so severe as to prevent performance of normal duties/activities, worsening, development of significant swelling or skin color change, soreness in uninjured areas, or not improving within one week.","If direct access to physical therapy (physical therapy sick call) is available, consider direct referral to physical therapy in accordance with local policy."],
  B11DP3 = [],
  B11DP4 = [],
  B11DPRE = [],
  B11DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”","DP 1. In the setting of trauma, deformity with loss of peripheral pulses or sensation is an indication of a medical emergency. Immobilize the affected extremity prior to transport. Cola colored urine or inability to urinate after exercise can be a sign of rhabdomyolysis. Bolus 1 liter of normal saline to help flush the myoglobin out of the kidneys. Severe pain can be a sign of compartment syndrome and may require emergent surgical decompression. Pain with weight bearing or starts after a certain point during exercise can be a sign of a stress injury. Increase in exercise, long endurance training, or recent modification to training can be risk factors of a stress injury. Place the Soldier on crutches until a bone stress injury is ruled out. Swelling or erythema can be signs of an infection or a venous blood clot."],
  B11PRO = ["Provide home exercise program. Activity modification as appropriate","Intermittent ice or heat for inflammation","Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed","Refer to PT if direct access is available","Return to clinic if worsening or not improving within 1 week."],
  B11LIMITATIONS = ["Use the activity limitations for the joint in the protocols above that is closest to the area."],
  B11GEN = ["pg. 49-50"],
  B11MEDCOM = ["Initial Management of Fractures/Spinal Injury pg.69 (2)(d)"],
  B11STP1 = [" Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222 ","Subject Area 7: Musculoskeletal. Apply a Rigid Splint. 081-833-0263 ","Subject Area 7: Musculoskeletal. Apply and Elastic Bandage. 081-833-0264"],

 //C2 
  C2ACT1 = [],
  C2ACT2 = [],
  C2ACT3 = [],
  C2DP1 = ["DP 1. Recent hospitalization and antibiotic use are risk factors for a clostridium difficile infection. Clostridium difficile infections often present with a strong odor and bloody diarrhea and can result in life threatening infections. Bloody diarrhea that is not just on the toilet paper from repetitive irritation or from a gastrointestinal bleed is likely the result of an invasive infection. Visibly bloody diarrhea could also be from inflammatory bowel disease or ischemic colitis. Severe abdominal pain as Soldier appearing in discomfort/distress including moaning, crying, bending over, trouble moving or pain rating of 8+/10."],
  C2DP2 = ["DP 2. Severe or persistent symptoms may require the use of empiric antibiotics."],
  C2DP3 = ["MCP for Diarrhea. Start a clear liquid diet (broth, fruit juice, sports drink, caffeine free soda) for 24 hours. Advance to a BRAT (banana, rice, apple sauce, toast) diet of simple carbohydrates next. Watch for signs of dehydration. Pepto-Bismol (1st line) may be given to the Soldier for the symptomatic control of diarrhea. Discuss with the supervising provider if antibiotics are required when considering to use Imodium (2nd line). Frequent hand washing should be used after using the bathroom and before eating. Food workers must not handle food till after symptoms have resolved. Advise the Soldier to return for medical assistance if the symptoms last more than one week, if symptoms worsen, or if he becomes dizzy and/or faints upon standing."],
  C2DP4 = [],
  C2DPRE = [],
  C2DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Nausea/ vomiting blood or coffee grinds and melena can be signs of an intestinal bleeding. Melena is a tar like stool with a very pungent odor resulting from the digestion of blood."],
  C2PRO = ["Medication: bismuth subsalicylate (1st line) as needed, discuss with provider before giving Imodium (2nd line)","Initiate a clear liquid diet with broth, sports drinks, cler non-caffeine soft drinks, fruit juice, ice chips to maintain calories and hydration. When diarrhea controlled, start BRAT diet of simple carbohydrates."],
  C2LIMITATIONS = ["No food handling, if work in a DFAC, until symptoms have resolved x 48 hours", "Must have access to a restroom within 2 minutes"],
  C2GEN = ["Pg. 52-53: Acute diarrhea in adults are often infectious in nature. The largest risk is due to volume depletion secondary to fluid loss. Small intestine infections often results in large, watery bowel movements associated with cramping, bloating, and gas symptoms. Large intestine infections often results in frequent regular, small bowel movements that are painful and associated with symptoms of mucous, blood, or fever. In general, diarrhea is often self-limited. Note that treatment of the symptoms by decreasing bowel movements frequency may extend the length of the disease."],
  C2MEDCOM = ["Obtain Laboratory Specimens pg. 69-70 (2)(k)"],
  C2STP1 = [ "Subject Area 2: Medical Treatment. Initiate Treatment for a Poisoned Casualty. 081-833-0004", "Subject Area 6: Primary Care. Provide Treatment for Abdominal Disorders. 081-833-0239", "Subject Area 16: CBRN. Provide Treatment for a Radiation Casualty. 081-833-0280"],
  
//c3
  C3ACT1 = ["Pregnancy Screen/ Test"],
  C3ACT2 = ["Screen nausea, diarrhea, pelvic pain, constipation, heartburn, urinary Sx, or other symptoms"],
  C3ACT3 = [],
  C3DP1 = ["DP 1. Suspected melena and coffee grind emesis should be tested and referred to a privileged provider if positive."],
  C3DP2 = ["DP 2. Periumbilical pain that moves to the right lower quadrant (RLQ) is a sign of appendicitis. Pancreatitis and appendicitis are often associated with a loss of appetite. Women of childbearing age should have their pregnancy status verified. Abdominal pain in the setting of pregnancy or recent abdominal trauma can signify an underlying issue. Chronic abdominal pain requires further evaluation by a qualified provider. New-onset benign, functional illness in a Soldier 50 plus years old is unlikely and should be evaluated further."],
  C3DP3 = ["MCP for Abdominal Pain. After significant underlying diseases have been ruled out, many causes of abdominal pain are not identified in the acute setting. Gas pain, constipation, stress are some of the potential other causes of the pain. The pain usually resolves on its own. Initial treatment includes hydration and a well-balanced, high fiber diet to help with any potential issues with constipation. A food diary looks for potential triggers. Follow-up if symptoms worsen, red flags, new symptoms, or no improvement in three days."],
  C3DP4 = [],
  C3DPRE = [,"DP 3. Abdominal pain frequently accompanies nausea, diarrhea, and constipation. Soldiers should be screened for the complaint. Pelvic pain has an additional partial differential diagnosis and should be screened according to that protocol. Urinary symptoms can progress from a urinary tract infection to a bladder infection causing flank pain."],
  C3DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Unstable vitals represent a significant health risk. Abdominal rigidity and rebound or significant Soldier discomfort with bumping the Soldier’s stretcher/chair are signs of peritonitis and can represent a surgical abdomen. Level of pain may represent the significance of the underlying disease."],
  C3PRO = ["Initiate hydration with 8 glasses of water per day and a well-balanced, high fiber diet.","Maintain a food diary to see if the symptoms are related to a particular food.","Follow-up in 3 days if the symptoms have not resolved or earlier if symptoms worsenn, new symptoms develop, or red flags become present"],
  C3LIMITATIONS = ["No running, jumping, riding in vehicle over uneven terrain"," Aerobic activity at own pace/ distance", "Abdominal training at own intensity/ rep"],
  C3GEN = ["pg. 55-56: Abdominal pain is pain between the ribs and groin in the front half of the body. Note that a cardiac problem can cause upper abdominal pain. Pain may be related to the location: right upper quadrant (RUQ) (liver, gallbladder), left upper quadrant (LUQ) (spleen), epigastric (stomach, pancreas, aorta, heart), lower (intestines, urinary tract, hernia, pelvic organs), flank (kidney)."],
  C3MEDCOM = ["Obtain Laboratory Specimens pg. 69-70 (2)(k)"],
  C3STP1 = ["Task Subject Area 6: Primary Care. Provide Treatment for Abdominal Disorders. 081-833-0239"],

  C4ACT1 = ["FOBT unless unable to obtain stool sample"],
  C4ACT2 = [],
  C4ACT3 = [],
  C4DP1 = ["DP 1. Feeling lightheaded and orthostatic hypotension can be signs of significant blood loss. Hemoccult stool test can identify blood in the stool. Blood only on the outside of the stool or toilet paper is more likely to be from a hemorrhoid or anal fissure. If a stool sample cannot be obtained except by a rectal exam, then refer as “Provider Now” for the rectal exam. If a hemoccult stool test is not available, then Soldiers with blood on the outside of the stool or on the toilet paper only should be considered as negative. Blood mixed in with the stool should be treated as positive. If you are unsure, consider it positive."],
  C4DP2 = ["DP 2. These are symptoms of more concerning disease processes to include cancer with a family history of colon cancer before 45 years old, inflammatory bowel disease, and invasive gastroenteritis."],
  C4DP3 = ["MCP for hemorrhoids and anal fissures. To decrease the amount of irritation, the stool needs to be soft. Advise the Soldier to ensure adequate intake of fluids (8 glasses a day), eat foods high in fiber like bran cereal and fresh fruits and vegetables, and spend less than five minutes on the toilet at a time. Increase fiber slowly as too much fiber at once may cause stomach cramping and gas. Tell the Soldier that the area should be kept clean by washing with warm water and blotting (rather than wiping) dry. Sitting in warm water can improve healing. Polyethylene glycol (1st line) or docusate sodium (2nd line) can be used to help keep the stool soft. Hydrocortisone and pramoxine cream (3rd line) can be used if needed for inflammation and pain. Instruct the Soldier in its use and to return for evaluation if the symptoms worsen, new symptoms develop, or symptoms last longer than one week or recurs."],
  C4DP4 = [],
  C4DPRE = [],
  C4DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of hemodynamically significant stomach/ intestinal bleeding."],
  C4PRO = ["Sit in warm water for 30min a day. Wash the area with warm water and blotting dry to keep clean.","Drink 8 glasses of liquid a day and eat foods high in fiber.","Medication: Polyethylene glycol (1st line) or docusate sodium (2nd line) can be used to soften the stool, and hydrocortisone and pramoxine cream (3rd line) can be used if needed for inflammation and pain","Return to clinic if not improved in 1 week, symptoms worsen, or new symptoms develop."],
  C4LIMITATIONS = [],
  C4GEN = ["pg. 57-58: Rectal pain, itching, and bleeding are often signs of hemorrhoids or an anal fissure but more serious conditions must be ruled out. Hemorrhoids are enlarged veins around the rectum that protrude; get rubbed; and/or become painful from inflammation related to a small clot forming within the vein. Hemorrhoids are not dangerous but can be extremely uncomfortable. A Soldier who has a history of hemorrhoids or anal fissure and then develops similar symptoms likely has a recurrence. Soldier should be instructed on avoiding constipation since it is a common cause of hemorrhoids and anal fissures. Most people with itching (and no other symptoms) do not have a serious disease."],
  C4MEDCOM = ["N/A"],
  C4STP1 = ["Subject Area 6: Primary Care. Provide Treatment for Abdominal Disorders. 081-833-0239","Subject Area 15: Primary Care. Test a Stool Sample. 081-833-0256"],



  C5ACT1 = ["Screen rectal bleeding or other symptoms if present"],
  C5ACT2 = [],
  C5ACT3 = [],
  C5DP1 = ["DP 1. These are symptoms of hypothyroidism. Soldiers that screen positive for possible hypothyroidism should be referred for further evaluation."],
  C5DP2 = ["DP 2. Rectal bleeding can be a sign of significant internal bleeding that requires further evaluation."],
  C5DP3 = ["The most important step in treating constipation is to alter the diet so that it contains plenty of fiber. Fiber is that part of food which is not absorbed into the body but instead remains in the intestines and absorbs water to form the bulk of the bowel movements. Without proper bulk, the large and small intestines cannot work properly, and this causes constipation. Fiber is present in bran cereal, whole wheat bread, fresh fruits, and vegetables. Ensure that the Soldier is taking adequate water (8 glasses a day).","Laxatives can be used on a one-time basis but should not be used repeatedly because the body can become dependent on them. After the bisacodyl, use polyethylene glycol for two weeks (1st line) or docusate sodium for one week (2nd line) to prevent recurrence. Not everyone has a bowel movement every day. Bowel movements may occur as often as three times a day or once every three days and still be normal. Discomfort and a change in pattern are more reliable guides to a diagnosis of constipation. Instruct the Soldier to return for medical assistance if abdominal pain develops, if the interval between movements is three days or longer, or if blood appears in his or her stool."],
  C5DP4 = [],
  C5DPRE = [],
  C5DPRED = [],
  C5PRO = ["Counsel the Soldier to drink 8 glasses of water per day and eat foods that are high in fiber","Medication: bisacodyl for acute constipation followed by a polyethylene glycol for 2 weeks (1st line) or docusate sodium for 1 week (2nd line)","Return to clinic for blood in stool, abdominal pain, or not having a BM for 3 days"],
  C5LIMITATIONS = [],
  C5GEN = ["pg. 59-60: Constipation means infrequent or difficult bowel movements. Soldiers use the word to mean many things—painful defecation, narrowing of the stools, or not having a “regular daily” bowel movement. Normal bowel habits differ from Soldier to Soldier; therefore, a wide variation exists in what Soldiers consider to be normal or to be a problem.", "Because constipation and hemorrhoids commonly occur together, rectal bleeding may be falsely attributed to these causes. This can be a dangerous mistake. Rectal bleeding must be screened as a separate problem. Constipation not associated with rectal bleeding may be appropriately treated through minor-care."],
  C5MEDCOM = ["N/A"],
  C5STP1 = ["Subject Area 6: Primary Care. Provide Treatment for Abdominal Disorders. 081-833-0239"],
//C6
  C6ACT1 = ["Include glucagon if unable to transport within 24 hours of onset"],
  C6ACT2 = ["Screen sore throat or other symptoms if present"],
  C6ACT3 = [],
  C6DP1 = ["DP 1. Most common cause of dysphagia in an adult is an acute food obstruction. It is often due to swallowing a piece of meat that has not been fully chewed. Food obstruction will present with a feeling of something stuck in the throat and decreased or inability to swallow. The obstruction must be removed promptly. Complete obstruction should undergo an emergent endoscopy. A partial obstruction should undergo endoscopy within 24 hours. The esophagus can start to ulcerate and the risk of esophageal perforation increases after 24 hours. If endoscopic evaluation/ treatment is not available within 24 hours, see the treatment protocol below."],
  C6DP2 = ["DP 2. Other causes of dysphagia not related to a sore throat should be evaluated by the AEM.","DP 3. Dysphagia frequently accompanies a severe sore throat. However, MAKE CERTAIN that dysphagia did not precede the sore throat. Causes of dysphagia not associated with a sore throat may require a more extensive evaluation."],
  C6DP3 = [],
  C6DP4 = [],
  C6DPRE = [],
  C6DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Airway compromise is an emergency. Coughing, choking, or nasal regurgitation when initiating a swallow is a sign of decreased ability to maintain the airway. The Soldier is at risk for aspiration."],
  C6PRO = ["Do not administer meat tenderizers to Soldiers with an esophageal food impaction. It could cause serious esophageal injury. Glucagon can be administered to relax the esophagus as an initial attempt for the Soldier to spontaneously pass the food bolus when a referral for an endoscopic evaluation/ treatment is not available. Treatment must be prescribed by a supervising privileged provider."],
  C6LIMITATIONS = [],
  C6GEN = ["pg. 61-62: Dysphagia means difficulty or pain when swallowing."],
  C6MEDCOM = ["Obtain Laboratory Specimens pg. 69-70 (2)(k)"],
  C6STP1 = [  "Subject Area 6: Primary Care. Perform a HEENT Exam. 081-833-0254"],
//C7
  C7ACT1 = ["Oxygen, EKG, chewable aspirin"],
  C7ACT2 = ["Oxygen, EKG, chewable aspirin"],
  C7ACT3 = [],
  C7DPRED = ["If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”","These can be signs of significant underlying medical problems."],
  C7DP1 = ["Oxygen, EKG, and chewable aspirin","Angina (substernal chest pressure, worse with exercise), shortness of breath, tachycardia, lightheaded, sweating, shoulder or jaw pain can be signs and symptoms of a myocardial infarction.","Obtain an EKG and give aspirin (if no signs of bleeding).", "Do not wait to provide oxygen, give aspirin, and start IV before notifying the supervising privileged provider.","Vomiting blood or coffee grinds and melena are signs of a bleeding ulcer.", "Tearing pain that radiates to the back is a sign of a dissecting aortic aneurysm."],
  C7DP2 = ["These are symptoms that suggest a more chronic condition than just heartburn. ","History of an ulcer suggests gastritis or another ulcer. ","Unexplained weight loss is a sign of cancer.", "Anorexia and vomiting are signs of pancreatitis.","Dysphagia and odynophagia are signs of esophagitis and chronic gastroesophageal reflux disease."],
  C7DP3 =["MCP for gastroesophageal reflux. It occurs due to the passage of gastric contents into the esophagus. It is a normal physiologic process that can result in brief episodes of heartburn. Overeating, tobacco, alcohol, overweight, stress, certain foods can act as triggers to increase the frequency of heartburn.","Instruct Soldier on lifestyle modifications: weight loss if overweight, smoking cessation if indicated, and elevation of head of bed, avoidance of chocolate/caffeine/spicy foods/ alcohol/other foods that exacerbate symptoms. Ranitidine (histamine 2 receptor antagonist) as needed for symptoms. Ranitidine reaches peak of action about 2.5 hours after taking and lasts around 8 hours. Return if symptoms are not controlled with minor-care measures, new symptoms arise, or Soldier is having to take the over the counter medication more than once per week."],
  C7DP4 =[""],
  C7DPRE = ["Soldier without the previous concerning symptoms and classic heartburn symptoms can be treated with over the counter medications and lifestyle changes.","If other symptoms are present, he or she should be screened for those symptoms."],
  C7PRO = ["Medication: Ranitidine as needed (up to 2 doses in 24 hours)","Lifestyle modification: weight loss if indicated, smoking cessation if indicated, elevation of head of bed, avoidance of foods that make it worse.","Return to clinic if any of the red flags or other symptoms develop, not improved with Minor Care Protocol, or taking ranitidine more than once per week on average."],
  C7LIMITATIONS = [],
  C7GEN = ["pg. 63-64: Heartburn is a common finding but can also be a sign of a more serious condition like a gastric ulcer or heart attack."],
  C7MEDCOM = ["Performs 12-lead Electrocardiogram pg. 69-70 (2)(o-p) "],
  C7STP1 = ["Subject Area 12: Medical Treatment. Obtain an Electrocardiogram. 081-833-3007 ","Subject Area 6: Primary Care. Provide Treatment for Abdominal Disorders. 081-833-0239"],

  D1ACT1 = ["Oxygen, EKG, IV"],
  D1ACT2 = ["Oxygen, EKG, IV, Aspirin 325 mg"],
  D1ACT3 = ["DP 3. Identifies conditions that are self-limited or can be treated with a minor-care protocol."],
  D1DP1 = ["DP 1. Tachycardia, sweating, pain or pressure in the chest, shoulder, or jaw can be symptoms of a myocardial infarction. Chest pain and tachycardia can also be signs of a pulmonary embolism. Irregular pulse identifies an arrhythmia. Do not wait to provide oxygen, give aspirin, and start IV before notifying the supervising privileged provider."],
  D1DP2 = ["DP 2. Screens for other medical conditions requiring further evaluation. Productive cough and elevated temperature are signs of pneumonia. Symptoms lasting longer than 10 days may not be viral. History of asthma or wheezing screens for an asthma exacerbation."],
  D1DP3 = ["MCP for cold symptoms: Counsel the Soldier to drink plenty of fluids and rest, cover their mouth when they cough and wash hands to prevent spread. Ibuprofen for pain, acetaminophen for elevated temperature, decongestant for nasal congestion, guaifenesin for mucous, or antihistamine for allergies. Return to clinic if not improving within one week, worsening symptoms, fever, new sinus pain, lightheadedness, or pain in the neck.", "MCP for panic attack symptoms (chest tightness, palpitations, anxious, lightheaded): Check EKG. If EKG is normal, initiate observed deep breathing exercises. Place a pulse oximeter on the Soldier’s finger. Have the Soldier lay back at a 45 degree angle with legs uncrossed and initiate diaphragmatic breathing exercises with deep, slow inhalation over 4 seconds and exhalation over another 4 second count. If the SpO2 starts to drop, disposition the Soldier as “Provider Now”.Refer Soldier to Behavioral Health after initial panic attack decreases in intensity."],
  D1DP4 = [],
  D1DPRE = [],
  D1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now”. Start the Soldier on oxygen with non-rebreather mask at 10 Liters/ minute, start an IV and IVF at TKO and obtain EKG if available. They can be signs of significant underlying medical problems."],
  D1PRO = [],
  D1LIMITATIONS = ["Cold Symptoms","Aerobic training at own pace/distance x 3 days","Limit exposure to temperatures below <50 degrees F"],
  D1GEN = ["pg. 65-66: Dyspnea is a sensation of breathing discomfort that can be in respiratory or cardiovascular in nature."],
  D1MEDCOM = ["Initiate an Intravenous Infusion pg.69 (2)(a)","Provide Oxygen pg.69 (2)(h)","Performs 12-lead Electrocardiogram pg. 69-70 (2)(o-p)"],
  D1STP1 = ["Subject Area 5: Venipuncture and IV Therapy. Initiate an Intravenous Infusion. 081-833-0033", "Subject Area 6: Primary Care. Provide Care for Common Respiratory Disorders. 081-833-0245"],

  D2ACT1 = [],
  D2ACT2 = [],
  D2ACT3 = [],
  D2DP1 = ["DP 1. Obtain an EKG if available. Tachycardia, sweating, pain, and pressure in the chest, shoulder, or jaw can be symptoms of a myocardial infarction. Note that diabetics and women can present atypically. Chest pain and tachycardia can also be signs of a pulmonary embolism or arrhythmia. Do not wait to provide oxygen, give aspirin, and start IV before notifying the supervising privileged provider."],
  D2DP2 = ["DP 2. Elevated temperature and productive cough screens for pneumonia. Recent chest trauma screens for multiple etiologies to include a rib fracture."],
  D2DP3 = ["DP 3. Conditions that are not identified below should be referred to the AEM for further evaluation."],
  D2DP4 = ["Cold or allergy symptoms: A-3 Minor Care Protocol","Panic attack symptoms: Check EKG. Monitor pulse oximeter. Supervised deep breathing exercises. Referral to provider now if oxygenation decreases or symptoms do not resolve. Refer to behavioral health after dyspnea symptoms have resolved"],
  D2DPRE = [],
  D2DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now”. Start them on oxygen with a nasal cannula at four-six liters/ minute, start an IV and IVF at TKO, give a chewable aspirin. These can be signs of significant underlying medical problems."],
  D2PRO = ["Cold liky symptoms: A-3 Protocol","Hearbutn: C-7 Protocol","Panic attack symptoms: Check EKG. Monitor pulse oximeter. Supervised deep breathing exercises. Referral to provider now if oxygenation decreases or symptoms do not resolve. Refer to behavioral health after dyspnea symptoms have resolved","Musculoskeletal: Medications: ibuprofen or acetaminophen for pain, analgesic balm for muscle/tendons. Temporary profile x 3 days if needed. Return to the clinic if pain increases, not improved in four days, shortness of breath/dizziness/or new symptoms develop."],
  D2LIMITATIONS = ["MSK Chest Pain: May lift, push up to 25 lbs","Cold Symptoms: Aerobic training at own pace/distance x 3 days","Limit exposure to temperatures below <50 degrees F"],
  D2GEN = ["pg. 67-68: Chest pain must always be taken seriously. It is a sign of many serious conditions."],
  D2MEDCOM = [],
  D2STP1 = [],

    // B4ACT1 = [],
  // B4ACT2 = [],
  // B4ACT3 = [],
  // B4DP1 = [],
  // B4DP2 = [],
  // B4DP3 = [],
  // B4DP4 = [],
  // B4DPRE = [],
  // B4DPRED = [],
  // B4PRO = [],
  // B4LIMITATIONS = [],
  // B4GEN = [],
  // B4MEDCOM = [],
  // B4STP1 = [],

end =[];
//Array linking decision trees to the ul creation function

const A2decision = {  
"DACT1" : A2ACT1,
"DACT2" : A2ACT2,
"DACT3" : A2ACT3,
"DPRED" : A2DPRED,
"DP1" : A2DP1,
"DP2" : A2DP2,
"DP3" : A2DP3,
"DP4" : A2DP4,
"DPRE" : A2DPRE,
"DPRO" : A2PRO,
"DLIM" : A2LIMITATIONS,
"GEN" : A2GEN,
"MED" : A2MEDCOM,
"STP" : A2STP1,
}

const A3decision = {  
"DACT1" : A3ACT1,
"DACT2" : A3ACT2,
"DACT3" : A3ACT3,
"DPRED" : A3DPRED,
"DP1" : A3DP1,
"DP2" : A3DP2,
"DP3" : A3DP3,
"DP4" : A3DP4,
"DPRE" : A3DPRE,
"DPRO" : A3PRO,
"DLIM" : A3LIMITATIONS,
"GEN" : A3GEN,
"MED" : A3MEDCOM,
"STP" : A3STP1,
}
const A4decision = {  
  "DACT1" : A4ACT1,
  "DACT2" : A4ACT2,
  "DACT3" : A4ACT3,
  "DPRED" : A4DPRED,
  "DP1" : A4DP1,
  "DP2" : A4DP2,
  "DP3" : A4DP3,
  "DP4" : A4DP4,
  "DPRE" : A4DPRE,
  "DPRO" : A4PRO,
  "DLIM" : A4LIMITATIONS,
  "GEN" : A4GEN,
  "MED" : A4MEDCOM,
  "STP" : A4STP1,
  }

const A5decision = { 
"DACT1" : A5ACT1,
"DACT2" : A5ACT2,
"DACT3" : A5ACT3,
"DPRED" : A5DPRED,
"DP1" : A5DP1,
"DP2" : A5DP2,
"DP3" : A5DP3,
"DP4" : A5DP4,
"DPRE" : A5DPRE,
"DPRO" : A5PRO,
"DLIM" : A5LIMITATIONS,
"GEN" : A5GEN,
"MED" : A5MEDCOM,
"STP" : A5STP1
}
const B1decision = { 
"DACT1" : B1ACT1,
"DACT2" : B1ACT2,
"DACT3" : B1ACT3,
"DPRED" : B1DPRED,
"DP1" : B1DP1,
"DP2" : B1DP2,
"DP3" : B1DP3,
"DP4" : B1DP4,
"DPRE" : B1DPRE,
"DPRO" : B1PRO,
"DLIM" : B1LIMITATIONS,
"GEN" : B1GEN,
"MED" : B1MEDCOM,
"STP" : B1STP1
}
const B2decision = {
"DACT1" : B2ACT1,
"DACT2" : B2ACT2,
"DACT3" : B2ACT3,
"DPRED" : B2DPRED,
"DP1" : B2DP1,
"DP2" : B2DP2,
"DP3" : B2DP3,
"DP4" : B2DP4,
"DPRE" : B2DPRE,
"DPRO" : B2PRO,
"DLIM" : B2LIMITATIONS,
"GEN" : B2GEN,
"MED" : B2MEDCOM,
"STP" : B2STP1
}
const B3decision = {
"DACT1" : B3ACT1,
"DACT2" : B3ACT2,
"DACT3" : B3ACT3,
"DPRED" : B3DPRED,
"DP1" : B3DP1,
"DP2" : B3DP2,
"DP3" : B3DP3,
"DP4" : B3DP4,
"DPRE" : B3DPRE,
"DPRO" : B3PRO,
"DLIM" : B3LIMITATIONS,
"GEN" : B3GEN,
"MED" : B3MEDCOM,
"STP" : B3STP1
}

const B4decision = {
  "DACT1" : B4ACT1,
  "DACT2" : B4ACT2,
  "DACT3" : B4ACT3,
  "DPRED" : B4DPRED,
  "DP1" : B4DP1,
  "DP2" : B4DP2,
  "DP3" : B4DP3,
  "DP4" : B4DP4,
  "DPRE" : B4DPRE,
  "DPRO" : B4PRO,
  "DLIM" : B4LIMITATIONS,
  "GEN" : B4GEN,
  "MED" : B4MEDCOM,
  "STP" : B4STP1,
  }
const B5decision = {
  "DACT1" : B5ACT1,
  "DACT2" : B5ACT2,
  "DACT3" : B5ACT3,
  "DPRED" : B5DPRED,
  "DP1" : B5DP1,
  "DP2" : B5DP2,
  "DP3" : B5DP3,
  "DP4" : B5DP4,
  "DPRE" : B5DPRE,
  "DPRO" : B5PRO,
  "DLIM" : B5LIMITATIONS,
  "GEN" : B5GEN,
  "MED" : B5MEDCOM,
  "STP" : B5STP1,
  }
const B6decision = {
  "DACT1" : B6ACT1,
  "DACT2" : B6ACT2,
  "DACT3" : B6ACT3,
  "DPRED" : B6DPRED,
  "DP1" : B6DP1,
  "DP2" : B6DP2,
  "DP3" : B6DP3,
  "DP4" : B6DP4,
  "DPRE" : B6DPRE,
  "DPRO" : B6PRO,
  "DLIM" : B6LIMITATIONS,
  "GEN" : B6GEN,
  "MED" : B6MEDCOM,
  "STP" : B6STP1,
  }
const B7decision = {
  "DACT1" : B7ACT1,
  "DACT2" : B7ACT2,
  "DACT3" : B7ACT3,
  "DPRED" : B7DPRED,
  "DP1" : B7DP1,
  "DP2" : B7DP2,
  "DP3" : B7DP3,
  "DP4" : B7DP4,
  "DPRE" : B7DPRE,
  "DPRO" : B7PRO,
  "DLIM" : B7LIMITATIONS,
  "GEN" : B7GEN,
  "MED" : B7MEDCOM,
  "STP" : B7STP1,
  }
const B8decision = {
  "DACT1" : B8ACT1,
  "DACT2" : B8ACT2,
  "DACT3" : B8ACT3,
  "DPRED" : B8DPRED,
  "DP1" : B8DP1,
  "DP2" : B8DP2,
  "DP3" : B8DP3,
  "DP4" : B8DP4,
  "DPRE" : B8DPRE,
  "DPRO" : B8PRO,
  "DLIM" : B8LIMITATIONS,
  "GEN" : B8GEN,
  "MED" : B8MEDCOM,
  "STP" : B8STP1,
  }
const B9decision = {
"DACT1" : B9ACT1,
"DACT2" : B9ACT2,
"DACT3" : B9ACT3,
"DPRED" : B9DPRED,
"DP1" : B9DP1,
"DP2" : B9DP2,
"DP3" : B9DP3,
"DP4" : B9DP4,
"DPRE" : B9DPRE,
"DPRO" : B9PRO,
"DLIM" : B9LIMITATIONS,
"GEN" : B9GEN,
"MED" : B9MEDCOM,
"STP" : B9STP1,
}
const B10decision = {
"DACT1" : B10ACT1,
"DACT2" : B10ACT2,
"DACT3" : B10ACT3,
"DPRED" : B10DPRED,
"DP1" : B10DP1,
"DP2" : B10DP2,
"DP3" : B10DP3,
"DP4" : B10DP4,
"DPRE" : B10DPRE,
"DPRO" : B10PRO,
"DLIM" : B10LIMITATIONS,
"GEN" : B10GEN,
"MED" : B10MEDCOM,
"STP" : B10STP1,
}
const B11decision = {
"DACT1" : B11ACT1,
"DACT2" : B11ACT2,
"DACT3" : B11ACT3,
"DPRED" : B11DPRED,
"DP1" : B11DP1,
"DP2" : B11DP2,
"DP3" : B11DP3,
"DP4" : B11DP4,
"DPRE" : B11DPRE,
"DPRO" : B11PRO,
"DLIM" : B11LIMITATIONS,
"GEN" : B11GEN,
"MED" : B11MEDCOM,
"STP" : B11STP1,
}
const C2decision = {
  "DACT1" : C2ACT1,
  "DACT2" : C2ACT2,
  "DACT3" : C2ACT3,
  "DPRED" : C2DPRED,
  "DP1" : C2DP1,
  "DP2" : C2DP2,
  "DP3" : C2DP3,
  "DP4" : C2DP4,
  "DPRE" : C2DPRE,
  "DPRO" : C2PRO,
  "DLIM" : C2LIMITATIONS,
  "GEN" : C2GEN,
  "MED" : C2MEDCOM,
  "STP" : C2STP1,
  }
const C3decision = {
"DACT1" : C3ACT1,
"DACT2" : C3ACT2,
"DACT3" : C3ACT3,
"DPRED" : C3DPRED,
"DP1" : C3DP1,
"DP2" : C3DP2,
"DP3" : C3DP3,
"DP4" : C3DP4,
"DPRE" : C3DPRE,
"DPRO" : C3PRO,
"DLIM" : C3LIMITATIONS,
"GEN" : C3GEN,
"MED" : C3MEDCOM,
"STP" : C3STP1,
}
const C4decision = {
  "DACT1" : C4ACT1,
  "DACT2" : C4ACT2,
  "DACT3" : C4ACT3,
  "DPRED" : C4DPRED,
  "DP1" : C4DP1,
  "DP2" : C4DP2,
  "DP3" : C4DP3,
  "DP4" : C4DP4,
  "DPRE" : C4DPRE,
  "DPRO" : C4PRO,
  "DLIM" : C4LIMITATIONS,
  "GEN" : C4GEN,
  "MED" : C4MEDCOM,
  "STP" : C4STP1,
  }
const C5decision = {
  "DACT1" : C5ACT1,
  "DACT2" : C5ACT2,
  "DACT3" : C5ACT3,
  "DPRED" : C5DPRED,
  "DP1" : C5DP1,
  "DP2" : C5DP2,
  "DP3" : C5DP3,
  "DP4" : C5DP4,
  "DPRE" : C5DPRE,
  "DPRO" : C5PRO,
  "DLIM" : C5LIMITATIONS,
  "GEN" : C5GEN,
  "MED" : C5MEDCOM,
  "STP" : C5STP1,
  }
const C6decision = {
  "DACT1" : C6ACT1,
  "DACT2" : C6ACT2,
  "DACT3" : C6ACT3,
  "DPRED" : C6DPRED,
  "DP1" : C6DP1,
  "DP2" : C6DP2,
  "DP3" : C6DP3,
  "DP4" : C6DP4,
  "DPRE" : C6DPRE,
  "DPRO" : C6PRO,
  "DLIM" : C6LIMITATIONS,
  "GEN" : C6GEN,
  "MED" : C6MEDCOM,
  "STP" : C6STP1,
  }
const C7decision = {
"DACT1" : C7ACT1,
"DACT2" : C7ACT2,
"DACT3" : C7ACT3,
"DPRED" : C7DPRED,
"DP1" : C7DP1,
"DP2" : C7DP2,
"DP3" : C7DP3,
"DP4" : C7DP4,
"DPRE" : C7DPRE,
"DPRO" : C7PRO,
"DLIM" : C7LIMITATIONS,
"GEN" : C7GEN,
"MED" : C7MEDCOM,
"STP" : C7STP1,
}
const D1decision = {
"DACT1" : D1ACT1,
"DACT2" : D1ACT2,
"DACT3" : D1ACT3,
"DPRED" : D1DPRED,
"DP1" : D1DP1,
"DP2" : D1DP2,
"DP3" : D1DP3,
"DP4" : D1DP4,
"DPRE" : D1DPRE,
"DPRO" : D1PRO,
"DLIM" : D1LIMITATIONS,
"GEN" : D1GEN,
"MED" : D1MEDCOM,
"STP" : D1STP1,
}
const D2decision = {
  "DACT1" : D2ACT1,
  "DACT2" : D2ACT2,
  "DACT3" : D2ACT3,
  "DPRED" : D2DPRED,
  "DP1" : D2DP1,
  "DP2" : D2DP2,
  "DP3" : D2DP3,
  "DP4" : D2DP4,
  "DPRE" : D2DPRE,
  "DPRO" : D2PRO,
  "DLIM" : D2LIMITATIONS,
  "GEN" : D2GEN,
  "MED" : D2MEDCOM,
  "STP" : D2STP1,
  }

const link1 ={
  // "A-1" : A1decision,
  "A-2" : A2decision,
  "A-3" : A3decision,
  "A-4" : A4decision,
  "A-5" : A5decision,
  "B-1" : B1decision,
  "B-2" : B2decision,
  "B-3" : B3decision,
  "B-4" : B4decision,
  "B-5" : B5decision,
  "B-6" : B6decision,
  "B-7" : B7decision,
  "B-8" : B8decision,
  "B-9" : B9decision,
  "B-10" : B10decision,
  "B-11" : B11decision,
  // "C-1" : C1decision,
  "C-2" : C2decision,
  "C-3" : C3decision,
  "C-4" : C4decision,
  "C-5" : C5decision,
  "C-6" : C6decision,
  "C-7" : C7decision,
  "D-1" : D1decision,
  "D-2" : D2decision,
  // "E-1" : E1decision,
  // "E-2" : E2decision,
  // "E-3" : E3decision,
  // "E-4" : E4decision,
  // "F-1" : F1decision,
  // "F-2" : F2decision,
  // "F-3" : F3decision,
  // "F-4" : F4decision,
  // "F-5" : F5decision,
  // "F-6" : F6decision,
  // "G-1" : G1decision,
  // "G-2" : G2decision,
  // "H-1" : H1decision,
  // "H-2" : H2decision,
  // "H-3" : H3decision,
  // "H-4" : H4decision,
  // "I-1" : I1decision,
  // "I-2" : I2decision,
  // "I-3" : I3decision,
  // "I-4" : I4decision,
  // "I-5" : I5decision,
  // "I-6" : I6decision,
  // "J-1" : J1decision,
  // "J-2" : J2decision,
  // "J-3" : J3decision,
  // "J-4" : J4decision,
  // "J-5" : J5decision,
  // "J-6" : J6decision,
  // "J-7" : J7decision,
  // "J-8" : J8decision,
  // "J-9" : J9decision,
  // "J-10" : J10decision,
  // "J-11" : J11decision,
  // "J-12" : J12decision,
  // "J-13" : J13decision,
  // "J-14" : J14decision,
  // "J-15" : J15decision,
  // "J-16" : J16decision,
  // "J-17" : J17decision,
  // "J-18" : J18decision,
  // "K-1" : K1decision,
  // "K-2" : K2decision,
  // "K-3" : K3decision,
  // "K-4" : K4decision,
  // "K-5" : K5decision,
  // "K-6" : K6decision,
  // "K-7" : K7decision,
  // "L-1" : L1decision,
  // "L-2" : L2decision,
  // "L-3" : L3decision,
  // "L-4" : L4decision,
  // "L-5" : L5decision,
  // "L-6" : L6decision,
  // "L-7" : L7decision,
  // "L-8" : L8decision,
  // "L-9" : L9decision,
  // "L-10" : L10decision,
  // "L-11" : L11decision,
  // "L-12" : L12decision,
  // "M-1" : M1decision,
  // "M-2" : M2decision 
}

//Array linking main category buttons to the subcategory boxes
const subcatboxes = {
  btnA : document.querySelector("#subboxA"),
  btnB : document.querySelector("#subboxB"),
  btnC : document.querySelector("#subboxC"),
  btnD : document.querySelector("#subboxD"),
  btnE : document.querySelector("#subboxE"),
  btnF : document.querySelector("#subboxF"),
  btnG : document.querySelector("#subboxG"),
  btnH : document.querySelector("#subboxH"),
  btnI : document.querySelector("#subboxI"),
  btnJ : document.querySelector("#subboxJ"),
  btnK : document.querySelector("#subboxK"),
  btnL : document.querySelector("#subboxL"),
  btnM : document.querySelector("#subboxM")
};
//Array linking the boxes back to their buttons on the main box
const reversecatbox = {
subboxA : document.querySelector("#btn-A"),
subboxB : document.querySelector("#btn-B"),
subboxC : document.querySelector("#btn-C"),
subboxD : document.querySelector("#btn-D"),
subboxE : document.querySelector("#btn-E"),
subboxF : document.querySelector("#btn-F"),
subboxG : document.querySelector("#btn-G"),
subboxH : document.querySelector("#btn-H"),
subboxI : document.querySelector("#btn-I"),
subboxJ : document.querySelector("#btn-J"),
subboxK : document.querySelector("#btn-K"),
subboxL : document.querySelector("#btn-L"),
subboxM : document.querySelector("#btn-M"),
}
//Array linking the labels (A-1, A-2, A-3) to their ADTSheet
const ADTMCSheets = {
    A1label : A1,
    A2label : A2,
    A3label : A3,
    A4label : A4,
    A5label : A5,
    B1label : B1,
    B2label : B2,
    B3label : B3,
    B4label : B4,
    B5label : B5,
    B6label : B6,
    B7label : B7,
    B8label : B8,
    B9label : B9,
    B10label : B10,
    B11label : B11,
    C1label : C1,
    C2label : C2,
    C3label : C3,
    C4label : C4,
    C5label : C5,
    C6label : C6,
    C7label : C7,
    D1label : D1,
    D2label : D2,
    E1label : E1,
    E2label : E2,
    E3label : E3,
    E4label : E4,
    F1label : F1,
    F2label : F2,
    F3label : F3,
    F4label : F4,
    F5label : F5,
    F6label : F6,
    G1label : G1,
    G2label : G2,
    H1label : H1,
    H2label : H2,
    H3label : H3,
    H4label : H4,
    I1label : I1,
    I2label : I2,
    I3label : I3,
    I4label : I4,
    I5label : I5,
    I6label : I6,
    J1label : J1,
    J2label : J2,
    J3label : J3,
    J4label : J4,
    J5label : J5,
    J6label : J6,
    J7label : J7,
    J8label : J8,
    J9label : J9,
    J10label : J10,
    J11label : J11,
    J12label : J12,
    J13label : J13,
    J14label : J14,
    J15label : J15,
    J16label : J16,
    J17label : J17,
    J18label : J18,
    K1label : K1,
    K2label : K2,
    K3label : K3,
    K4label : K4,
    K5label : K5,
    K6label : K6,
    K7label : K7,
    L1label : L1,
    L2label : L2,
    L3label : L3,
    L4label : L4,
    L5label : L5,
    L6label : L6,
    L7label : L7,
    L8label : L8,
    L9label : L9,
    L10label : L10,
    L11label : L11,
    L12label : L12,
    M1label : M1,
    M2label : M2 
}


//hamburger button events
menu.addEventListener("click", ()=> {
        if (document.querySelectorAll('.selected').length > 0) {
            document.querySelectorAll('.selected').forEach(el => {
              el.classList.remove('selected');
            })
            
        }
        homecatbox.classList.remove("closed");
            homecatbox.classList.add("selected");
        if (banner.classList.contains("open")){
          banner.classList.toggle("open");
          homebanner.classList.toggle("closed");
          rtn.classList.toggle("closed");
        }
        if(Acontainer.classList.contains("open")){
          Acontainer.classList.remove("open");
          subbanner.classList.remove("open")
          banner.classList.remove("closed");
          algorithm.querySelectorAll(".ADTsheet").forEach(el => {
          el.classList.remove('open')});
          algorithm.querySelectorAll(".dispobox").forEach(el => {
          el.classList.remove('open')});
          algorithm.querySelectorAll(".justbox").forEach(el => {
          el.classList.remove('open')});
          algorithm.querySelectorAll(".check").forEach(el => {
          el.checked = false});
          algorithm.querySelectorAll(".label").forEach(el => {
          el.innerHTML = "NO"});
          complaints.classList.remove("paged");
        }
        homecatbox.classList.add('selected');
        complaints.classList.toggle("closed");
        info.classList.remove("open");
        icon.classList.remove("open");
        medi.classList.remove("show");
        menu.classList.toggle("closed");
});

//Get from the main menu to the subcategories
const rtn = document.querySelector(".return");
const itembtns = document.querySelectorAll(".itembtn");
itembtns.forEach(function(currentSwitch){
  currentSwitch.addEventListener('click',()=> {
    if (document.querySelectorAll('.selected').length > 0) {
        document.querySelectorAll('.selected').forEach(el => {
          el.classList.remove('selected');
        })
    }
    homecatbox.classList.add("closed");
    currentSwitch.related = currentSwitch.id;
    console.log(currentSwitch.id);
    subcatboxes[currentSwitch.related].classList.add("selected");
    homebanner.classList.add("closed");
    banner.innerText = currentSwitch.innerText;
    banner.classList.add("open");
    rtn.classList.toggle("closed");
  });
});
//return button (back to main menu)
rtn.addEventListener("click", ()=> {
  if(!Acontainer.classList.contains("open")){
    if (document.querySelectorAll('.selected').length > 0) {
      document.querySelectorAll('.selected').forEach(el => {
        el.classList.remove('selected');
      })
  }
    homecatbox.classList.remove('closed');
    homecatbox.classList.add("selected");
    banner.classList.remove("open");
    homebanner.classList.remove("closed");
    rtn.classList.toggle("closed");
  }
  if(Acontainer.classList.contains("open")){
    Acontainer.classList.remove("open");
    icon.classList.remove("open");
    info.classList.remove("open");
    subbanner.classList.toggle("open");
    banner.classList.remove("closed")
    algorithm.querySelectorAll(".ADTsheet").forEach(el => {
    el.classList.remove('open')});
    algorithm.querySelectorAll(".dispobox").forEach(el => {
    el.classList.remove('open')});
    algorithm.querySelectorAll(".justbox").forEach(el => {
    el.classList.remove('open')});
    algorithm.querySelectorAll(".check").forEach(el => {
    el.checked = false});
    algorithm.querySelectorAll(".label").forEach(el => {
    el.innerHTML = "NO"});
    complaints.classList.remove("paged");
  }
});





//open ADTMC sheets from the subtext buttons
const ADTsheets = document.querySelectorAll(".ADTsheet");
const ADTMCpagers = document.querySelectorAll(".subtexts");
ADTMCpagers.forEach(function(currentPager){
currentPager.addEventListener('click',()=> { 
  const bLabel = document.querySelector("#banner3-label")
  complaints.classList.add('paged');
  Acontainer.classList.toggle('open');
  banner.classList.add("closed");
  subbanner.classList.add("open");
  bLabel.innerHTML = currentPager.innerHTML;
  const sheetnow = ADTMCSheets[currentPager.id];
  sheetnow.classList.add("open");
  Acontainer.scrollTop = 0;
  ADTpage.scrollTop = 0;
  
});
});
//all ADTsheet toggles
function DC(){
  var btnid = event.target.id;
  var btn = document.getElementById(btnid);
  var dad = btn.closest(".ADTsheet");
  var box = btn.closest(".Qbox");
  console.log(box.id);
  var dispo = box.querySelector(".dispobox");
  var just = box.querySelector(".justbox");
  console.log(just);
  if(just.classList.contains("open")){just.classList.toggle("open")}
  if(btn.checked){
      let a = btn.parentElement;
      let b = a.parentElement;
      let c = b.parentElement;
      const d = c.querySelector(".label");
      d.innerHTML = "YES";

      if(!dispo.classList.contains("open")){dispo.classList.toggle("open");
    };
      functions[dad.id]();
      

  }
  else{
      let a = btn.parentElement;
      let b = a.parentElement;
      let c = b.parentElement;
      const d = c.querySelector(".label");
      d.innerHTML = "NO";
      if(dispo.classList.contains("open")){dispo.classList.toggle("open")};
      functions[dad.id]();
  };
  };

//My special princess button in A-2/A-4 that just toggles more questions
function DC2(){
  var btnid = event.target.id;
  var btn = document.getElementById(btnid);
  var dad = btn.closest(".ADTsheet");
  var box = btn.closest(".Qbox");
  console.log(box.id);
  if(btn.checked){
      let a = btn.parentElement;
      let b = a.parentElement;
      let c = b.parentElement;
      const d = c.querySelector(".label");
      d.innerHTML = "YES";
      functions[dad.id]();
  }
  else{
      let a = btn.parentElement;
      let b = a.parentElement;
      let c = b.parentElement;
      const d = c.querySelector(".label");
      d.innerHTML = "NO";
      functions[dad.id]();
  };
  };

  function MED(){
    medi.classList.toggle("show");
    medcont.classList.toggle("open");
    
  };
  

  //toggle explanation box
function explain(){
  var btn = event.target;
  console.log(btn);
  var a = btn.parentElement;
  var b = a.parentElement;
  var c = b.querySelector(".justbox");
  c.classList.toggle("open");

}

const icon = document.querySelector("#btni")
const info = document.querySelector(".infobox");
const medi = document.querySelector("#medbtn");
const medcont = document.querySelector(".medbox1");
const nav = document.querySelector(".navbox");

function infobox(){
  info.classList.toggle("open")
  icon.classList.toggle("open");
};

//   ","

// const labelbanners = {
//   A1label : "A-1 Sore Throat/Hoarseness",
//   A2label :"A-2 Ear Pain/Drainage/Trauma",
//   A3label :"A-3 Cold Symptoms/Allergies/Cough",
//   A4label :"A-4 Ringing in the Ears/Hearing Problem",
//   A5label :"A-5 Nosebleed/Nose Trauma",
//   B1label : "B-1 Back Pain",
//   B2label : "B-2 Neck Pain", 
//   B3label : "B-3 Shoulder Pain", 
//   B4label : "B-4 Elbow Pain",
//   B5label : "B-5 Wrist Pain", 
//   B6label : "B-6 Hand Pain", 
//   B7label : "B-7 Hip Pain", 
//   B8label : "B-8 Knee Pain", 
//   B9label : "B-9 Ankle Pain", 
//   B10label : "B-10 Foot Pain", 
//   B11label : "B-11 Extremity, Non-joint Pain", 
//   C1label : "C-1 Nausea/Vomiting ", 
//   C2label : "C-2 Diarrhea ", 
//   C3label : "C-3 Abdominal and Flank Pain", 
//   C4label : "C-4 Rectal Pain/Itching/Bleeding", 
//   C5label : "C-5 Constipation", 
//   C6label : "C-6 Difficulty When Swallowing", 
//   C7label : "C-7 Heartburn", 
//   D1label : "D-1 Shortness of Breath", 
//   D2label : "D-2 Chest Pain", 
//   E1label : "E-1 Painful/Frequent Urination", 
//   E2label : "E-2 Groin/Testicular Pain or Urethral Discharge", 
//   E3label : "E-3 Sexually Transmitted Infection (STI)", 
//   E4label : "E-4 Problems with Voiding", 
//   F1label : "F-1 Dizziness/Faintness/Blackout ", 
//   F2label : "F-2 Headache", 
//   F3label : "F-3 Numbness/Tingling/Paralysis/Weakness ", 
//   F4label : "F-4 Drowsiness/Confusion", 
//   F5label : "F-5 Depression/Nervousness/Anxiety/Tension", 
//   F6label : "F-6 Minor Traumatic Brain Injury", 
//   G1label : "G-1 Fatigue ", 
//   G2label : "G-2 Fever/Chills", 
//   H1label : "H-1 Eye Pain/Redness/Discharge/Itching/Injury", 
//   H2label : "H-2 Eyelid Problem", 
//   H3label : "H-3 Decreased Vision, Seeing Spots, Request for Glasses", 
//   H4label : "H-4 Seeing Double (Diplopia)", 
//   I1label : "I-1 Breast Problems ", 
//   I2label : "I-2 Suspects Pregnancy", 
//   I3label : "I-3 Menstrual Problems, Vaginal Bleeding", 
//   I4label : "I-4 Vaginal Discharge, Itching, Irritation, or Pain", 
//   I5label : "I-5 Request for PAP or Routine Pelvic Examination ", 
//   I6label : "I-6 Request for Information on Contraception", 
//   J1label : "J-1 Unknown Cause of Skin Disorder", 
//   J2label : "J-2 Acne", 
//   J3label : "J-3 Shaving-Pseudofolliculitis Barbae (Ingrown Hairs)", 
//   J4label : "J-4 Dandruff (Scaling of the Scalp)", 
//   J5label : "J-5 Hair Loss", 
//   J6label : "J-6 Athlete’s Foot (Tinea Pedis)", 
//   J7label : "J-7 Jock Itch (Tinea Cruris)", 
//   J8label : "J-8 Scaling, Depigmented Spots (Tinea Versicolor)", 
//   J9label : "J-9 Boils", 
//   J10label : "J-10 Fever Blisters (Cold Sores)", 
//   J11label : "J-11 Skin Abrasion/Laceration", 
//   J12label : "J-12 Suture Removal", 
//   J13label : "J-13 Drug Rash, Contact Dermatitis", 
//   J14label : "J-14 Burns/Sunburn", 
//   J15label : "J-15 Friction Blisters on Feet", 
//   J16label : "J-16 Corns on Feet", 
//   J17label : "J-17 Cutaneous (Plantar) Warts", 
//   J18label : "J-18 Ingrown Toenai", 
//   K1label : "K-1 Exertional Heat Illness/ Hyperthermia", 
//   K2label : "K-2 Hypothermia", 
//   K3label : "K-3 Immersion Foot", 
//   K4label : "K-4 Chapped Skin/Windburn", 
//   K5label : "K-5 Frostbite", 
//   K6label : "K-6 Crabs/Lice (Pediculosis) ", 
//   K7label : "K-7 Insect Bites (Not Crabs/Lice)", 
//   L1label : "L-1 Exposed to Hepatitis or HIV", 
//   L2label : "L-2 Dental Problems", 
//   L3label : "L-3 Sores in the Mouth", 
//   L4label : "L-4 Prescription Refill", 
//   L5label : "L-5 Requests a Vasectomy", 
//   L6label : "L-6 Needs an Immunization", 
//   L7label : "L-7 Lymph Node Enlargement", 
//   L8label : "L-8 Blood Pressure Check", 
//   L9label : "L-9 Medical Screening for Overseas PCS", 
//   L10label : "L-10 Weight Reduction", 
//   L11label : "L-11 Complaint Not on the List", 
//   L12label : "L-12 Request for Nonprescription or Traveling Medication", 
//   M1label : "M-1 No Signs of Improvement", 
//   M2label : "M-2 Return Requested by Provider" 
// }


//ddxs
const A1ddxs = ['Viral Infections', 'Bacterial Infection', 'Meningitis', 'Neck Deep Tissue Infection', 'Candida infection', 'Strep Throat'];
const A2ddxs = ["Otitis Media/Externa", "Esutachian tube dysfunction", "Nasopharyngeal pathology", "Deep space head/neck infections", "Meningitis", "Mastoiditis", "Ruptured Ear Drum", "TMJ Dysfunction"];
const A3ddxs = ["Allergic or seasonal rhinitis","Bacterial pharyngitis or tonsillitis","Acute bacterial rhinosinusitis","Influenza","Pertussis"];
const A4ddxs = ["Cerumen Impaction","Otitis Media","Otosclerosis","Ruptured Ear Drum","Eustachian Tube Dysfunction","Hearing Loss","Disorders of the Jaw Joint","Severe Anxiety","Neck Injuries"];
const A5ddxs = ["Upper Respiratory Infections","Allergic or Viral Rhinitis","Trauma","Bleeding Disorder","Foreign Body"];
const B1ddxs = ["Muscle Sprain/Strain"," Fracture"," Infection ","Renal Stone/UTI ","Arthritis ","Cauda Equina Syndrome"];
const B2ddxs = ["Muscle Strain", "Fracture", "Meningitis", "Flu", "Deep neck space infection"];
const B3ddxs = ["Tendon inflammation/tear","Instability (dislocation)","Arthritis","Fracture","Myocardial Infarction"]
const B4ddxs = ["Muscle Strain","Fracture","Dislocation","Tendonitis","Bursitis"];
const B5ddxs = ["Fracture","Carpal Tunnel","Arthritis","Bursitis","Tendonitis","Muscle Strain"];
const B6ddxs = ["Fracture/ Dislocation","Gout","Carpal Tunnel Syndrome","Arthritis","Tendonitis","Muscle Strain"];
const B7ddxs = ["Arthritis","Stress Fracture","Trochanteric Bursitis","Tendinitis","Muscle Strain","Hernia","Referred Pain"];
const B8ddxs = ["Ligament or Cartilage Injury","Arthritis","Overuse Injury","Infection/Inflammation","Bursitis"];
const B9ddxs = ["Sprain/Strain","Fracture","Tendon Rupture","Arthritis","Bursitis","Tendinopathy"];
const B10ddxs = ["Injury","Overuse","Plantar Fasciitis","Tarsal Tunnel Syndrome","Achilles Tendinopathy","Ingrown Toenail","Bunion"]; 
const B11ddxs = ["Fracture","Laceration","Bruise","Stress Reaction"];
const C1ddxs = [];
const C2ddxs = ["Food Intolerance", "Medication", "Infection (Viral/Bacterial)", "Dizziness", "Chest Pain", "Ear Pain", "Heartburn"];
const C3ddxs = [];
const C4ddxs = [];
const C5ddxs = [];
const C6ddxs = [];
const C7ddxs = ["Gastroesophageal Reflux","Myocardial Infarction","Stomach/Duodenal Ulcer","Cancer","Pancreatitis"];
const D1ddxs = [];
const D2ddxs = [];
const E1ddxs = [];
const E2ddxs = [];
const E3ddxs = [];
const E4ddxs = [];
const F1ddxs = [];
const F2ddxs = [];
const F3ddxs = [];
const F4ddxs = [];
const F5ddxs = [];
const F6ddxs = [];
const G1ddxs = [];
const G2ddxs = [];
const H1ddxs = [];
const H2ddxs = [];
const H3ddxs = [];
const H4ddxs = [];
const I1ddxs = [];
const I2ddxs = [];
const I3ddxs = [];
const I4ddxs = [];
const I5ddxs = [];
const I6ddxs = [];
const J1ddxs = [];
const J2ddxs = [];
const J3ddxs = [];
const J4ddxs = [];
const J5ddxs = [];
const J6ddxs = [];
const J7ddxs = [];
const J8ddxs = [];
const J9ddxs = [];
const J10ddxs = [];
const J11ddxs = [];
const J12ddxs = [];
const J13ddxs = [];
const J14ddxs = [];
const J15ddxs = [];
const J16ddxs = [];
const J17ddxs = [];
const J18ddxs = [];
const K1ddxs = [];
const K2ddxs = [];
const K3ddxs = [];
const K4ddxs = [];
const K5ddxs = [];
const K6ddxs = [];
const K7ddxs = [];
const L1ddxs = [];
const L2ddxs = [];
const L3ddxs = [];
const L4ddxs = [];
const L5ddxs = [];
const L6ddxs = [];
const L7ddxs = [];
const L8ddxs = [];
const L9ddxs = [];
const L10ddxs = [];
const L11ddxs = [];
const L12ddxs = [];
const M1ddxs = [];
const M2ddxs = [];
//redflags            ","
const A1flags = ["SOB", "Stridor", "Deviated Uvula", "Drooling/ Trouble Swallowing ", "Stiff Neck"];
const A2flags = ["Stiff Neck AND Fever", "Posterior ear pain and/or mastoid erythema"];
const A3flags = ["Abnormal Vital Signs","Shortness of Breath","Stiff Neck","Altered Mental Status","Coughing up blood clots or frank blood"];
const A4flags = ["Altered Mental Status","Focal Neurological Symptom or Sign","Dizziness"];
const A5flags = ["- Airway Compromise","Orthostatic Hypotension","Bleeding from Gums","Inability to Move Eye"];
const B1flags = ["Fever", "Saddle Anesthesia", "Urinary Retention/", "Incontinence Fecal Incontinence", " Motor Deficits", "Trauma with Vertebral Tenderness or Neuropathy", "Dysuria/Frequency", "Chest/Abdominal Pain"];
const B2flags = ["Bony step off/midline", "tenderness to palpation", "Inability to flex neck","Fever", "Recent HEENT or dental", "infection"];
const B3flags = ["Distal Pulses Abnormal", "Distal Sensation Abnormal", "Deformity", "Cardiac Symptoms"];
const B4flags = ["Distal Pulses Abnormal","Distal Sensation Abnormal","Deformity"];
const B5flags = ["Distal Pulses Abnormal", "Distal Sensation Abnormal", "Deformity", "Open Fracture"];
const B6flags = ["Abnormal Capillary Refill","Abnormal Distal Sensation","Palmar Infection","Deformity","Significant Burn"];
const B7flags = ["Abnormal PMS", "Deformity", "High Energy Trauma", "Suspect Stress Fracture (increased with weight bearing or during exercise, endurance training, change in exercise routine)" ,"Severe Pain"];
const B8flags = ["Abnormal PMS", "Deformity", "High Energy Trauma"];
const B9flags = ["Abnormal Distal Pulse", "Abnormal Sensation", "Deformity"];
const B10flags = ["Abnormal Distal Pulse", "Abnormal Sensation", "Deformity", "Suspect Stress Fracture (increased with weight bearing or during exercise, endurance training, change in exercise routine)"];
const B11flags = ["Abnormal Distal Pulse", "Abnormal Sensation", "Deformity", "Cola Colored Urine", "Inability to Urinate"];
const C1flags = [];
const C2flags = ["Vomiting Blood or Coffee Grinds, Melena ","Severe abdominal pain"," Significant weight loss"];
const C3flags = [];
const C4flags = [];
const C5flags = [];
const C6flags = [];
const C7flags = ["Vomiting Blood or Coffee Grinds","Melena","Angina", "SOB","Radiation to Back"];
const D1flags = [];
const D2flags = [];
const E1flags = [];
const E2flags = [];
const E3flags = [];
const E4flags = [];
const F1flags = [];
const F2flags = [];
const F3flags = [];
const F4flags = [];
const F5flags = [];
const F6flags = [];
const G1flags = [];
const G2flags = [];
const H1flags = [];
const H2flags = [];
const H3flags = [];
const H4flags = [];
const I1flags = [];
const I2flags = [];
const I3flags = [];
const I4flags = [];
const I5flags = [];
const I6flags = [];
const J1flags = [];
const J2flags = [];
const J3flags = [];
const J4flags = [];
const J5flags = [];
const J6flags = [];
const J7flags = [];
const J8flags = [];
const J9flags = [];
const J10flags = [];
const J11flags = [];
const J12flags = [];
const J13flags = [];
const J14flags = [];
const J15flags = [];
const J16flags = [];
const J17flags = [];
const J18flags = [];
const K1flags = [];
const K2flags = [];
const K3flags = [];
const K4flags = [];
const K5flags = [];
const K6flags = [];
const K7flags = [];
const L1flags = [];
const L2flags = [];
const L3flags = [];
const L4flags = [];
const L5flags = [];
const L6flags = [];
const L7flags = [];
const L8flags = [];
const L9flags = [];
const L10flags = [];
const L11flags = [];
const L12flags = [];
const M1flags = [];
const M2flags = [];



const ddxslist = {
  A1label : A1ddxs,
  A2label : A2ddxs,
  A3label : A3ddxs,
  A4label : A4ddxs,
  A5label : A5ddxs,
  B1label : B1ddxs,
  B2label : B2ddxs,
  B3label : B3ddxs,
  B4label : B4ddxs,
  B5label : B5ddxs,
  B6label : B6ddxs,
  B7label : B7ddxs,
  B8label : B8ddxs,
  B9label : B9ddxs,
  B10label : B10ddxs,
  B11label : B11ddxs,
  C1label : C1ddxs,
  C2label : C2ddxs,
  C3label : C3ddxs,
  C4label : C4ddxs,
  C5label : C5ddxs,
  C6label : C6ddxs,
  C7label : C7ddxs,
  D1label : D1ddxs,
  D2label : D2ddxs,
  E1label : E1ddxs,
  E2label : E2ddxs,
  E3label : E3ddxs,
  E4label : E4ddxs,
  F1label : F1ddxs,
  F2label : F2ddxs,
  F3label : F3ddxs,
  F4label : F4ddxs,
  F5label : F5ddxs,
  F6label : F6ddxs,
  G1label : G1ddxs,
  G2label : G2ddxs,
  H1label : H1ddxs,
  H2label : H2ddxs,
  H3label : H3ddxs,
  H4label : H4ddxs,
  I1label : I1ddxs,
  I2label : I2ddxs,
  I3label : I3ddxs,
  I4label : I4ddxs,
  I5label : I5ddxs,
  I6label : I6ddxs,
  J1label : J1ddxs,
  J2label : J2ddxs,
  J3label : J3ddxs,
  J4label : J4ddxs,
  J5label : J5ddxs,
  J6label : J6ddxs,
  J7label : J7ddxs,
  J8label : J8ddxs,
  J9label : J9ddxs,
  J10label : J10ddxs,
  J11label : J11ddxs,
  J12label : J12ddxs,
  J13label : J13ddxs,
  J14label : J14ddxs,
  J15label : J15ddxs,
  J16label : J16ddxs,
  J17label : J17ddxs,
  J18label : J18ddxs,
  K1label : K1ddxs,
  K2label : K2ddxs,
  K3label : K3ddxs,
  K4label : K4ddxs,
  K5label : K5ddxs,
  K6label : K6ddxs,
  K7label : K7ddxs,
  L1label : L1ddxs,
  L2label : L2ddxs,
  L3label : L3ddxs,
  L4label : L4ddxs,
  L5label : L5ddxs,
  L6label : L6ddxs,
  L7label : L7ddxs,
  L8label : L8ddxs,
  L9label : L9ddxs,
  L10label : L10ddxs,
  L11label : L11ddxs,
  L12label : L12ddxs,
  M1label : M1ddxs,
  M2label : M2ddxs 
}
const redflaglist = {
  A1label : A1flags,
  A2label : A2flags,
  A3label : A3flags,
  A4label : A4flags,
  A5label : A5flags,
  B1label : B1flags,
  B2label : B2flags,
  B3label : B3flags,
  B4label : B4flags,
  B5label : B5flags,
  B6label : B6flags,
  B7label : B7flags,
  B8label : B8flags,
  B9label : B9flags,
  B10label : B10flags,
  B11label : B11flags,
  C1label : C1flags,
  C2label : C2flags,
  C3label : C3flags,
  C4label : C4flags,
  C5label : C5flags,
  C6label : C6flags,
  C7label : C7flags,
  D1label : D1flags,
  D2label : D2flags,
  E1label : E1flags,
  E2label : E2flags,
  E3label : E3flags,
  E4label : E4flags,
  F1label : F1flags,
  F2label : F2flags,
  F3label : F3flags,
  F4label : F4flags,
  F5label : F5flags,
  F6label : F6flags,
  G1label : G1flags,
  G2label : G2flags,
  H1label : H1flags,
  H2label : H2flags,
  H3label : H3flags,
  H4label : H4flags,
  I1label : I1flags,
  I2label : I2flags,
  I3label : I3flags,
  I4label : I4flags,
  I5label : I5flags,
  I6label : I6flags,
  J1label : J1flags,
  J2label : J2flags,
  J3label : J3flags,
  J4label : J4flags,
  J5label : J5flags,
  J6label : J6flags,
  J7label : J7flags,
  J8label : J8flags,
  J9label : J9flags,
  J10label : J10flags,
  J11label : J11flags,
  J12label : J12flags,
  J13label : J13flags,
  J14label : J14flags,
  J15label : J15flags,
  J16label : J16flags,
  J17label : J17flags,
  J18label : J18flags,
  K1label : K1flags,
  K2label : K2flags,
  K3label : K3flags,
  K4label : K4flags,
  K5label : K5flags,
  K6label : K6flags,
  K7label : K7flags,
  L1label : L1flags,
  L2label : L2flags,
  L3label : L3flags,
  L4label : L4flags,
  L5label : L5flags,
  L6label : L6flags,
  L7label : L7flags,
  L8label : L8flags,
  L9label : L9flags,
  L10label : L10flags,
  L11label : L11flags,
  L12label : L12flags,
  M1label : M1flags,
  M2label : M2flags 
}


//append information to li and ul of ADTsheets
//append ddxs
var cont = document.getElementById('ddxb');
var ul = document.createElement('ul');
ul.setAttribute('style', 'padding: 0; margin: 0;');
ul.setAttribute('id', 'theList');
//append red flags
var cont2 = document.getElementById('redf');
var ul2 = document.createElement('ul');
ul2.setAttribute('style', 'padding: 0; margin: 0;');
ul2.setAttribute('id', 'theList');


//button action triggering append if DOM exists
const btns = document.querySelectorAll(".subtexts");
btns.forEach(function(currentChild){
  currentChild.addEventListener('click',()=> {
    ul.innerHTML = '';
    ul2.innerHTML = '';
    const sheetnow = ADTMCSheets[currentChild.id];
    if(document.querySelector("#jsul4") == null){console.log("doesn't exist")}else{document.querySelector("#jsul4").remove()};
    if(document.querySelector("#jsul5") == null){console.log("doesn't exist")}else{document.querySelector("#jsul5").remove()};
    if(document.querySelector("#jsul6") == null){console.log("doesn't exist")}else{document.querySelector("#jsul6").remove()};
    if(document.querySelector("#jsul7") == null){console.log("doesn't exist")}else{document.querySelector("#jsul7").remove()};
    if(document.querySelector("#jsul8") == null){console.log("doesn't exist")}else{document.querySelector("#jsul8").remove()};
    if(document.querySelector("#jsul9") == null){console.log("doesn't exist")}else{document.querySelector("#jsul9").remove()};
    if(document.querySelector("#jsul10") == null){console.log("doesn't exist")}else{document.querySelector("#jsul10").remove()};
    if(document.querySelector("#jsul11") == null){console.log("doesn't exist")}else{document.querySelector("#jsul11").remove()};
    if(document.querySelector("#jsul12") == null){console.log("doesn't exist")}else{document.querySelector("#jsul12").remove()};
    if(document.querySelector("#jsul13") == null){console.log("doesn't exist")}else{document.querySelector("#jsul13").remove()};
    if(document.querySelector("#jsul14") == null){console.log("doesn't exist")}else{document.querySelector("#jsul14").remove()};
    if(document.querySelector("#jsul15") == null){console.log("doesn't exist")}else{document.querySelector("#jsul15").remove()};
    if(document.querySelector("#jsul16") == null){console.log("doesn't exist")}else{document.querySelector("#jsul16").remove()};
    const sheetid = sheetnow.id;
      const a = link1[sheetid];
      const just1 = a["DPRED"];
      const just2 = a["DP1"];
      const just3 = a["DP2"];
      const just4 = a["DP3"];
      const just5 = a["DP4"];
      const just6 = a["DPRO"];
      const just7 = a["DPRE"];
      const just8 = a["DLIM"];
      const just9 = a["DACT1"];
      const just12 = a["DACT2"];
      const just13 = a["GEN"];
      const just10 =a["MED"];
      const just11 =a["STP"];
    if(sheetnow.querySelector(".JRED") == null){console.log("JRED does not exist")}else{
      const cont4 = sheetnow.querySelector(".JRED");
      var ul4 = document.createElement('ul');
      ul4.innerHTML = '';
      ul4.setAttribute('id', 'jsul4'); 
      for (i = 0; i <= just1.length - 1; i++) {
      var li4 = document.createElement('li');
      li4.innerHTML = "";
      li4.innerHTML = just1[i];
      ul4.appendChild(li4);
      }
      cont4.appendChild(ul4);
    };

    if(sheetnow.querySelector(".JDP1") == null){console.log("JDP1 does not exist")}else{
      const cont5 = sheetnow.querySelector(".JDP1");
      var ul5 = document.createElement('ul');
      ul5.innerHTML = '';
      ul5.setAttribute('id', 'jsul5'); 
      for (i = 0; i <= just2.length - 1; i++) {
      var li5 = document.createElement('li');
      li5.innerHTML = "";
      li5.innerHTML = just2[i];
      ul5.appendChild(li5);
      }
      cont5.appendChild(ul5);
    }
    if(sheetnow.querySelector(".JDP2") == null){console.log("JDP2 does not exist")}else{
      const cont6 = sheetnow.querySelector(".JDP2");
      var ul6 = document.createElement('ul');
      ul6.innerHTML = '';
      ul6.setAttribute('id', 'jsul6'); 
      for (i = 0; i <= just3.length - 1; i++) {
      var li6 = document.createElement('li');
      li6.innerHTML = "";
      li6.innerHTML = just3[i];
      ul6.appendChild(li6);
      }
      cont6.appendChild(ul6);
    }
    if(sheetnow.querySelector(".JDP3") == null){console.log("JDP3 does not exist")}else{
      console.log("JDP3 is working");
      const cont7 = sheetnow.querySelector(".JDP3");
      var ul7 = document.createElement('ul');
      ul7.innerHTML = '';
      ul7.setAttribute('id', 'jsul7'); 
      for (i = 0; i <= just4.length - 1; i++) {
      var li7 = document.createElement('li');
      li7.innerHTML = "";
      li7.innerHTML = just4[i];
      ul7.appendChild(li7);
      }
      cont7.appendChild(ul7);
    }
    if(sheetnow.querySelector(".JDP4") == null){console.log("JDP4 does not exist")}else{
      const cont8 = sheetnow.querySelector(".JDP4");
      var ul8 = document.createElement('ul');
      ul8.innerHTML = '';
      ul8.setAttribute('id', 'jsul8'); 
      for (i = 0; i <= just5.length - 1; i++) {
      var li8 = document.createElement('li');
      li8.innerHTML = "";
      li8.innerHTML = just5[i];
      ul8.appendChild(li8);
      }
      cont8.appendChild(ul8);
    }
    if(sheetnow.querySelector(".JPROT") == null){console.log("JRTD does not exist")}else{
      const cont9 = sheetnow.querySelector(".JPROT");
      var ul9 = document.createElement('ul');
      ul9.innerHTML = '';
      ul9.setAttribute('id', 'jsul9'); 
      for (i = 0; i <= just6.length - 1; i++) {
      var li9 = document.createElement('li');
      li9.innerHTML = "";
      li9.innerHTML = just6[i];
      ul9.appendChild(li9);
      }
      cont9.appendChild(ul9);
    }

    if(sheetnow.querySelector(".JRETEST") == null){console.log("JRETEST does not exist")}else{
      const cont10 = sheetnow.querySelector(".JRETEST");
      var ul10 = document.createElement('ul');
      ul10.innerHTML = '';
      ul10.setAttribute('id', 'jsul10'); 
      for (i = 0; i <= just7.length - 1; i++) {
      var li10 = document.createElement('li');
      li10.innerHTML = "";
      li10.innerHTML = just7[i];
      ul10.appendChild(li10);
      }
      cont10.appendChild(ul10);
    }
    if(sheetnow.querySelector(".JAM") == null){console.log("JAM does not exist")}else{
      const cont11 = sheetnow.querySelector(".JAM");
      var ul11 = document.createElement('ul');
      ul11.innerHTML = '';
      ul11.setAttribute('id', 'jsul11'); 
      for (i = 0; i <= just8.length - 1; i++) {
      var li11 = document.createElement('li');
      li11.innerHTML = "";
      li11.innerHTML = just8[i];
      ul11.appendChild(li11);
      }
      cont11.appendChild(ul11);
    }
    if(sheetnow.querySelector(".ACT1") == null){console.log("ACT1 does not exist")}else{
      console.log(sheetnow.querySelector(".ACT1"));
      const cont12 = sheetnow.querySelector(".ACT1");
      var ul12 = document.createElement('ul');
      ul12.innerHTML = '';
      ul12.setAttribute('id', 'jsul12'); 
      for (i = 0; i <= just9.length - 1; i++) {
      var li12 = document.createElement('li');
      li12.innerHTML = "";
      li12.innerHTML = just9[i];
      ul12.appendChild(li12);
      }
      cont12.appendChild(ul12);
    }
    if(sheetnow.querySelector(".ACT2") == null){console.log("ACT2 does not exist")}else{
      console.log(sheetnow.querySelector(".ACT2"));
      const cont15 = sheetnow.querySelector(".ACT2");
      var ul15 = document.createElement('ul');
      ul15.innerHTML = '';
      ul15.setAttribute('id', 'jsul15'); 
      for (i = 0; i <= just12.length - 1; i++) {
      var li15 = document.createElement('li');
      li15.innerHTML = "";
      li15.innerHTML = just12[i];
      ul15.appendChild(li15);
      }
      cont15.appendChild(ul15);
    }
    if(document.querySelector(".box-1-text") == null){console.log(".box-1-text does not exist")}else{
      console.log(document.querySelector(".box-1-text"));
      const cont16 = document.querySelector(".box-1-text");
      var ul16 = document.createElement('ul');
      ul16.innerHTML = '';
      ul16.setAttribute('id', 'jsul16'); 
      for (i = 0; i <= just13.length - 1; i++) {
      var li16 = document.createElement('li');
      li16.innerHTML = "";
      li16.innerHTML = just13[i];
      ul16.appendChild(li16);
      }
      cont16.appendChild(ul16);
    }
    if(document.querySelector("#MEDCOM") == null){console.log("#MEDCOM does not exist")}else{
      console.log(document.querySelector("#MEDCOM"));
      const cont13 = document.querySelector("#MEDCOM");
      var ul13 = document.createElement('ul');
      ul13.innerHTML = '';
      ul13.setAttribute('id', 'jsul13'); 
      for (i = 0; i <= just10.length - 1; i++) {
      var li13 = document.createElement('li');
      li13.innerHTML = "";
      li13.innerHTML = just10[i];
      ul13.appendChild(li13);
      }
      cont13.appendChild(ul13);
    }
    if(document.querySelector("#STP") == null){console.log("MEDCOM does not exist")}else{
      console.log(document.querySelector("#STP"));
      const cont14 = document.querySelector("#STP");
      var ul14 = document.createElement('ul');
      ul14.innerHTML = '';
      ul14.setAttribute('id', 'jsul14'); 
      for (i = 0; i <= just11.length - 1; i++) {
      var li14 = document.createElement('li');
      li14.innerHTML = "";
      li14.innerHTML = just11[i];
      ul14.appendChild(li14);
      }
      cont14.appendChild(ul14);
    }
  
//append ddx list with the cont    
    const ddxarrayvalue = ddxslist[currentChild.id];
    const redflagvalue = redflaglist[currentChild.id];
    for (i = 0; i <= ddxarrayvalue.length - 1; i++) {
      var li = document.createElement('li');
      li.innerHTML = ddxarrayvalue[i];
      li.setAttribute('style', 'display: block;');
      ul.appendChild(li);
  }
  //append red flags with cont2
    for (i = 0; i <= redflagvalue.length - 1; i++) {
      var li2 = document.createElement('li');
      li2.innerHTML = redflagvalue[i];
      li2.setAttribute('style', 'display: block;');
      ul2.appendChild(li2);
  }
 //append ddx and red flag li to their ul after validation
  cont.appendChild(ul);
  cont2.appendChild(ul2);

});
});

//functions to link the id to the of the ADTSheet to how the disposition boxes pop up
const functions = {
  // "A-1" : justifyA1,
  "A-2" : justifyA2,
  "A-3" : justifyA3,
  "A-4" : justifyA4,
  "A-5" : justifyA5,
  "B-1" : justifyB1,
  "B-2" : justifyB2,
  "B-3" : justifyB3,
  "B-4" : justifyB4,
  "B-5" : justifyB5,
  "B-6" : justifyB6,
  "B-7" : justifyB7,
  "B-8" : justifyB8,
  "B-9" : justifyB9,
  "B-10" : justifyB10,
  "B-11" : justifyB11,
  // "C-1" : justifyC1,
  "C-2" : justifyC2,
  // "C-3" : justifyC3,
  // "C-4" : justifyC4,
  // "C-5" : justifyC5,
  // "C-6" : justifyC6,
  "C-7" : justifyC7,
  "D-1" : justifyD1,
  "D-2" : justifyD2,
  // "E-1" : justifyE1,
  // "E-2" : justifyE2,
  // "E-3" : justifyE3,
  // "E-4" : justifyE4,
  // "F-1" : justifyF1,
  // "F-2" : justifyF2,
  // "F-3" : justifyF3,
  // "F-4" : justifyF4,
  // "F-5" : justifyF5,
  // "F-6" : justifyF6,
  // "G-1" : justifyG1,
  // "G-2" : justifyG2,
  // "H-1" : justifyH1,
  // "H-2" : justifyH2,
  // "H-3" : justifyH3,
  // "H-4" : justifyH4,
  // "I-1" : justifyI1,
  // "I-2" : justifyI2,
  // "I-3" : justifyI3,
  // "I-4" : justifyI4,
  // "I-5" : justifyI5,
  // "I-6" : justifyI6,
  // "J-1" : justifyJ1,
  // "J-2" : justifyJ2,
  // "J-3" : justifyJ3,
  // "J-4" : justifyJ4,
  // "J-5" : justifyJ5,
  // "J-6" : justifyJ6,
  // "J-7" : justifyJ7,
  // "J-8" : justifyJ8,
  // "J-9" : justifyJ9,
  // "J-10" : justifyJ10,
  // "J-11" : justifyJ11,
  // "J-12" : justifyJ12,
  // "J-13" : justifyJ13,
  // "J-14" : justifyJ14,
  // "J-15" : justifyJ15,
  // "J-16" : justifyJ16,
  // "J-17" : justifyJ17,
  // "J-18" : justifyJ18,
  // "K-1" : justifyK1,
  // "K-2" : justifyK2,
  // "K-3" : justifyK3,
  // "K-4" : justifyK4,
  // "K-5" : justifyK5,
  // "K-6" : justifyK6,
  // "K-7" : justifyK7,
  // "L-1" : justifyL1,
  // "L-2" : justifyL2,
  // "L-3" : justifyL3,
  // "L-4" : justifyL4,
  // "L-5" : justifyL5,
  // "L-6" : justifyL6,
  // "L-7" : justifyL7,
  // "L-8" : justifyL8,
  // "L-9" : justifyL9,
  // "L-10" : justifyL10,
  // "L-11" : justifyL11,
  // "L-12" : justifyL12,
  // "M-1" : justifyM1,
  // "M-2" : justifyM2 


}

//individual justification scripts for each. called when the toggle button is switched
function justifyA2() {
  var btnid = event.target.id;
  console.log(btnid);
  const hidden = A2.querySelector(".subQ");
  const A2red = A2.querySelector("#A2-redbtn");
  const A2c1 = A2.querySelector("#A2-1-btn");
  const A2c2 = A2.querySelector("#A2-2-btn");
  const A2c3 = A2.querySelector("#A2-3-btn");
  const A2c4 = A2.querySelector("#A2-4-btn");
  const A2c5 = A2.querySelector("#A2-5-btn");
  const dispored = A2.querySelector("#A2dispo-red");
  const dispo2 = A2.querySelector("#A2dispo-2");
  const dispo3 = A2.querySelector("#A2dispo-3");
  const dispo4 = A2.querySelector("#A2dispo-4");
  const dispoRETEST = A2.querySelector("#A2dispo-RETEST");
  const dispoRTD = A2.querySelector("#A2dispo-RTD");
  if(A2c1.checked == true){
    if(!hidden.classList.contains("selected")){hidden.classList.toggle("selected")}
  }else{hidden.classList.remove("selected")}
  if(A2red.checked == true){
    console.log("it works");
    A2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
  }else{
      if(A2c2.checked == true){
        A2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispo2.classList.contains("open")){dispo2.classList.toggle("open");}
      }else{
        if(A2c3.checked == true){
            A2.querySelectorAll('.dispobox').forEach(el => {
              el.classList.remove('open')});
              if(!dispo3.classList.contains("open")){dispo3.classList.toggle("open");}
          }else{
        A2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(A2c4.checked == true){
            A2.querySelectorAll('.dispobox').forEach(el => {
              el.classList.remove('open')});
              if(!dispo4.classList.contains("open")){dispo4.classList.toggle("open");}
          }else{
            A2.querySelectorAll('.dispobox').forEach(el => {
              el.classList.remove('open')});
              if(A2c5.checked == true){
                A2.querySelectorAll('.dispobox').forEach(el => {
                  el.classList.remove('open')});
                  if(!dispoRETEST.classList.contains("open")){dispoRETEST.classList.toggle("open");}
              }else{
                if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}}
          }
          }
        }
      }
    }
//justification A-3
function justifyA3() {
  const A3red = A3.querySelector("#A3-redbtn");
  const A3c1 = A3.querySelector("#A3-1-btn");
  const A3c2 = A3.querySelector("#A3-2-btn");
  const dispored = A3.querySelector("#A3dispo-red");
  const dispo1 = A3.querySelector("#A3dispo-1");
  const dispo2 = A3.querySelector("#A3dispo-2");
  const dispoRTD = A3.querySelector("#A3dispo-RTD");
  if(A3red.checked == true){
      console.log("it works");
      A3.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')}); 
      if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
  }else{
      A3.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(A3c1.checked == true){
        A3.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};
  
      }else{
        if(A3c2.checked == true){
          A3.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispo2.classList.contains("open")){dispo2.classList.toggle("open");}
        }else{
          A3.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open");
            const Div = dispoRTD.offsetTop;
            ADTpage.scrollTo({ top: Div, behavior: 'smooth' })
          }
        }
      }
    }
  }
//Justification A4
  function justifyA4() {
    var btnid = event.target.id;
    console.log(btnid);
    const hidden = A4.querySelector(".subQ");
    const A4red = A4.querySelector("#A4-redbtn");
    const A4c1 = A4.querySelector("#A4-1-btn");
    const A4c2 = A4.querySelector("#A4-2-btn");
    const A4c3 = A4.querySelector("#A4-3-btn");
    const A4c4 = A4.querySelector("#A4-4-btn");
    const dispored = A4.querySelector("#A4dispo-red");
    const dispo1 = A4.querySelector("#A4dispo-1");
    const dispo3 = A4.querySelector("#A4dispo-3");
    const dispoRETEST = A4.querySelector("#A4dispo-RETEST");
    const dispoRTD = A4.querySelector("#A4dispo-RTD");
    if(A4c2.checked == true){
      if(!hidden.classList.contains("selected")){hidden.classList.toggle("selected")}
    }else{hidden.classList.remove("selected")}
    if(A4red.checked == true){
      console.log("it works");
      A4.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')}); 
      if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
    }else{
        if(A4c1.checked == true){
          A4.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open");}
        }else{
          if(A4c3.checked == true){
              A4.querySelectorAll('.dispobox').forEach(el => {
                el.classList.remove('open')});
                if(!dispo3.classList.contains("open")){dispo3.classList.toggle("open");}
            }else{
          A4.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(A4c4.checked == true){
              A4.querySelectorAll('.dispobox').forEach(el => {
                el.classList.remove('open')});
                if(!dispoRETEST.classList.contains("open")){dispoRETEST.classList.toggle("open");}
            }else{
                  if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}}
            }
            }
          }
        }

//justification A-5
function justifyA5(){ 
  console.log("it works");
  const A5red = A5.querySelector("#A5-redbtn");
  const A5c1 = A5.querySelector("#A5-1-btn");
  const A5c2 = A5.querySelector("#A5-2-btn");
  const A5c3 = A5.querySelector("#A5-3-btn");
  const dispored = A5.querySelector("#A5dispo-red");
  const dispo1 = A5.querySelector("#A5dispo-1");
  const dispo2 = A5.querySelector("#A5dispo-2");
  const dispoRETEST = A5.querySelector("#A5dispo-RETEST")
  const dispoRTD = A5.querySelector("#A5dispo-RTD");
  if(A5red.checked == true){
    console.log("it works");
    A5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
  }else{
    A5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(A5c1.checked == true){
      A5.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};

    }else{
      A5.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(A5c2.checked == true){
        A5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo2.classList.contains("open")){dispo2.classList.toggle("open")};

      }else{
        A5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(A5c3.checked == true){
          if(!dispoRETEST.classList.contains("open")){dispoRETEST.classList.toggle("open")};

        }else{
        A5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
    }}
  }
  }
}

//justification B-1
function justifyB1() {
  const B1red = B1.querySelector("#B1-redbtn");
  const B1c1 = B1.querySelector("#B1-1-btn");
  const dispored = B1.querySelector("#B1dispo-red");
  const dispo1 = B1.querySelector("#B1dispo-1");
  const dispoRTD = B1.querySelector("#B1dispo-RTD");
  if(B1red.checked == true){
    console.log("it works");
    B1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
  }else{
    B1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(B1c1.checked == true){
      B1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};

    }else{
        B1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
    }
  }
}

function justifyB2(){ 
  console.log("it works");
  const B2red = B2.querySelector("#B2-redbtn");
  const B2c1 = B2.querySelector("#B2-1-btn");
  const dispored = B2.querySelector("#B2dispo-red");
  const dispo1 = B2.querySelector("#B2dispo-1");
  const dispoRTD = B2.querySelector("#B2dispo-RTD");
  if(B2red.checked == true){
    console.log("it works");
    B2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
  }else{
    B2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(B2c1.checked == true){
      B2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};

    }else{
        B2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
    }
  }
}
//Justification B-3
function justifyB3(){ 
  console.log("it works");
  const B3red = B3.querySelector("#B3-redbtn");
  const B3c1 = B3.querySelector("#B3-1-btn");
  const dispored = B3.querySelector("#B3dispo-red");
  const dispo1 = B3.querySelector("#B3dispo-1");
  const dispoRTD = B3.querySelector("#B3dispo-RTD");
  if(B3red.checked == true){
    console.log("it works");
    B3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
  }else{
    B3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(B3c1.checked == true){
      B3.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};

    }else{
        B3.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
    }}
  }
//Justification B-4
function justifyB4(){ 
  console.log("it works");
  const B4red = B4.querySelector("#B4-redbtn");
  const B4c1 = B4.querySelector("#B4-1-btn");
  const dispored = B4.querySelector("#B4dispo-red");
  const dispo1 = B4.querySelector("#B4dispo-1");
  const dispoRTD = B4.querySelector("#B4dispo-RTD");
  if(B4red.checked == true){
    console.log("it works");
    B4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
  }else{
    B4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(B4c1.checked == true){
      B4.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};

    }else{
        B4.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
    }}
  }

//Justification B5
function justifyB5(){ 
  console.log("it works");
  const B5red = B5.querySelector("#B5-redbtn");
  const B5c1 = B5.querySelector("#B5-1-btn");
  const dispored = B5.querySelector("#B5dispo-red");
  const dispo1 = B5.querySelector("#B5dispo-1");
  const dispoRTD = B5.querySelector("#B5dispo-RTD");
  if(B5red.checked == true){
    console.log("it works");
    B5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
  }else{
    B5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(B5c1.checked == true){
      B5.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};

    }else{
        B5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
    }}
  }
//Justification B-6
function justifyB6(){ 
  console.log("it works");
  const B6red = B6.querySelector("#B6-redbtn");
  const B6c1 = B6.querySelector("#B6-1-btn");
  const dispored = B6.querySelector("#B6dispo-red");
  const dispo1 = B6.querySelector("#B6dispo-1");
  const dispoRTD = B6.querySelector("#B6dispo-RTD");
  if(B6red.checked == true){
    console.log("it works");
    B6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
  }else{
    B6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(B6c1.checked == true){
      B6.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};

    }else{
        B6.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
    }}
  }
//Justification B-7
function justifyB7(){ 
console.log("it works");
const B7red = B7.querySelector("#B7-redbtn");
const B7c1 = B7.querySelector("#B7-1-btn");
const dispored = B7.querySelector("#B7dispo-red");
const dispo1 = B7.querySelector("#B7dispo-1");
const dispoRTD = B7.querySelector("#B7dispo-RTD");
if(B7red.checked == true){
  console.log("it works");
  B7.querySelectorAll('.dispobox').forEach(el => {
    el.classList.remove('open')}); 
  if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
}else{
  B7.querySelectorAll('.dispobox').forEach(el => {
    el.classList.remove('open')});
  if(B7c1.checked == true){
    B7.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};

  }else{
      B7.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
        if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
  }}
}

function justifyB8(){ 
console.log("it works");
const B8red = B8.querySelector("#B8-redbtn");
const B8c1 = B8.querySelector("#B8-1-btn");
const dispored = B8.querySelector("#B8dispo-red");
const dispo1 = B8.querySelector("#B8dispo-1");
const dispoRTD = B8.querySelector("#B8dispo-RTD");
if(B8red.checked == true){
  console.log("it works");
  B8.querySelectorAll('.dispobox').forEach(el => {
    el.classList.remove('open')}); 
  if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
}else{
  B8.querySelectorAll('.dispobox').forEach(el => {
    el.classList.remove('open')});
  if(B8c1.checked == true){
    B8.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};

  }else{
      B8.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
        if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
  }}
}

function justifyB9(){ 
  console.log("it works");
  const B9red = B9.querySelector("#B9-redbtn");
  const B9c1 = B9.querySelector("#B9-1-btn");
  const dispored = B9.querySelector("#B9dispo-red");
  const dispo1 = B9.querySelector("#B9dispo-1");
  const dispoRTD = B9.querySelector("#B9dispo-RTD");
  if(B9red.checked == true){
    console.log("it works");
    B9.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
  }else{
    B9.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(B9c1.checked == true){
      B9.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};

    }else{
        B9.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
    }}
  }

  function justifyB10(){ 
    console.log("it works");
    const B10red = B10.querySelector("#B10-redbtn");
    const B10c1 = B10.querySelector("#B10-1-btn");
    const dispored = B10.querySelector("#B10dispo-red");
    const dispo1 = B10.querySelector("#B10dispo-1");
    const dispoRTD = B10.querySelector("#B10dispo-RTD");
    if(B10red.checked == true){
      console.log("it works");
      B10.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')}); 
      if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
    }else{
      B10.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(B10c1.checked == true){
        B10.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};
  
      }else{
          B10.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
      }}
    }

    
function justifyB11(){ 
console.log("it works");
const B11red = B11.querySelector("#B11-redbtn");
const B11c1 = B11.querySelector("#B11-1-btn");
const dispored = B11.querySelector("#B11dispo-red");
const dispo1 = B11.querySelector("#B11dispo-1");
const dispoRTD = B11.querySelector("#B11dispo-RTD");
if(B11red.checked == true){
  console.log("it works");
  B11.querySelectorAll('.dispobox').forEach(el => {
    el.classList.remove('open')}); 
  if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
}else{
  B11.querySelectorAll('.dispobox').forEach(el => {
    el.classList.remove('open')});
  if(B11c1.checked == true){
    B11.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};

  }else{
      B11.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
        if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
  }}
}

function justifyC2() {
  const C2red = C2.querySelector("#C2-redbtn");
  const C2c1 = C2.querySelector("#C2-1-btn");
  const C2c2 = C2.querySelector("#C2-2-btn");
  const dispored = C2.querySelector("#C2dispo-red");
  const dispo1 = C2.querySelector("#C2dispo-1");
  const dispo2 = C2.querySelector("#C2dispo-2");
  const dispoRTD = C2.querySelector("#C2dispo-RTD");
  if(C2red.checked == true){
      console.log("it works");
      C2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')}); 
      if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
  }else{
      C2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(C2c1.checked == true){
        C2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};
  
      }else{
        if(C2c2.checked == true){
          C2.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispo2.classList.contains("open")){dispo2.classList.toggle("open");}
        }else{
          C2.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
            }
          }
        }
      }
//anchor

//justification C-7
function justifyC7() {
  const C7red = C7.querySelector("#C7-redbtn");
  const C7c1 = C7.querySelector("#C7-1-btn");
  const C7c2 = C7.querySelector("#C7-2-btn");
  const C7c3 = C7.querySelector("#C7-3-btn");
  const dispored = C7.querySelector("#C7dispo-red");
  const dispo1 = C7.querySelector("#C7dispo-1");
  const dispo2 = C7.querySelector("#C7dispo-2");
  const dispoRETEST = C7.querySelector("#C7dispo-RETEST");
  const dispoRTD = C7.querySelector("#C7dispo-RTD");
  if(C7red.checked == true){
      console.log("it works");
      C7.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')}); 
      if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
  }else{
      C7.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(C7c1.checked == true){
        C7.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};
  
      }else{
        if(C7c2.checked == true){
          C7.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispo2.classList.contains("open")){dispo2.classList.toggle("open");}
        }else{
          if(C7c3.checked == true){
              C7.querySelectorAll('.dispobox').forEach(el => {
                el.classList.remove('open')});
                if(!dispoRETEST.classList.contains("open")){dispoRETEST.classList.toggle("open");}
            }else{
          C7.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
            }
          }
        }
      }
  }

function justifyD1() {
  const D1red = D1.querySelector("#D1-redbtn");
  const D1c1 = D1.querySelector("#D1-1-btn");
  const D1c2 = D1.querySelector("#D1-2-btn");
  const D1c3 = D1.querySelector("#D1-3-btn");
  const dispored = D1.querySelector("#D1dispo-red");
  const dispo1 = D1.querySelector("#D1dispo-1");
  const dispo2 = D1.querySelector("#D1dispo-2");
  const dispo3 = D1.querySelector("#D1dispo-3");
  const dispoRTD = D1.querySelector("#D1dispo-RTD");
  if(D1red.checked == true){
      console.log("it works");
      D1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')}); 
      if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
  }else{
      D1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(D1c1.checked == true){
        D1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};
  
      }else{
        if(D1c2.checked == true){
          D1.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispo2.classList.contains("open")){dispo2.classList.toggle("open");}
        }else{
          
        if(D1c3.checked == true){
          D1.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open");}
        }else{
          D1.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispo3.classList.contains("open")){dispo3.classList.toggle("open")}
            }
          }
        }
      }
    }


function justifyD2() {
  const D2red = D2.querySelector("#D2-redbtn");
  const D2c1 = D2.querySelector("#D2-1-btn");
  const D2c2 = D2.querySelector("#D2-2-btn");
  const dispored = D2.querySelector("#D2dispo-red");
  const dispo1 = D2.querySelector("#D2dispo-1");
  const dispo2 = D2.querySelector("#D2dispo-2");
  const dispo3 = D2.querySelector("#D2dispo-3");
  const dispoRTD = D2.querySelector("#D2dispo-RTD");
  if(D2red.checked == true){
      console.log("it works");
      D2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')}); 
      if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
  }else{
      D2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(D2c1.checked == true){
        D2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};
  
      }else{
        if(D2c2.checked == true){
          D2.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open");}
        }else{
          D2.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispo2.classList.contains("open")){dispo2.classList.toggle("open")}
            }
          }
        }
      }
