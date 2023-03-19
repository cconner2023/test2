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
  A1DP1 = ["DP2. 4 questions that look at the chance of having a Group A Streptococcal (GAS) infection. If 3 of the questions are positive, there is 32% chance of having GAS and a rapid antigen test (RADT) should be performed. The RADT is effective for ruling out GAS in adults but some Soldiers with GAS are missed. Culture test is performed when the RADT is negative and Soldiers or their contacts are at higher risk for complications from a GAS infection. Culture generally takes 24-48 hours for the results to return."],
  A1DP2 = ["Other protocols. Sore throat and hoarseness that are associated with a virus should be treated with minor-care. The other symptoms should be treated according to their associated protocols.","MCP for sore throat. A sore throat is often due to a viral infection. Minor-care consist of pain control, measures to decrease inflammation, getting plenty of rest and drinking plenty of fluids (water). Return for signs of the infection getting worse or progressing.","MCP for hoarseness. Hoarseness is often due to a virus or irritant. Minor-care consists of resting the vocal cords and avoidance of irritants (cigarette smoking, yelling, heartburn, post-nasal drip). This is a good opportunity to discuss the negative effects of tobacco use and encourage the Soldier to quit using tobacco, if applicable."],
  A1DP3 = [],
  A1DP4 = [],
  A1DPRE = ["DP3.  CENTOR score < 2 low risk of strep throat, screen other symptoms if present"],
  A1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” One-sided severe sore throat with fever, trouble swallowing as shown by drooling, uvula displacement, hoarseness (hot potato voice), trismus (lock jaw), and enlarged, tender tonsils are signs of a deep neck space infection like a peritonsillar abscess. Shortness of breath and stridor are signs of upper airway obstruction due to severe pharyngeal inflammation.","DP1. Symptoms greater than 10 days, immunosuppression, inhaled steroid medications are related to diseases that are unlikely to go away without treatment. Hoarseness longer than 2 weeks requires a full laryngeal exam."],
  A1PRO = ["MCP sore throat: For pain: lozenge first line, ibuprofen second line, for elevated temperature: acetaminophen, salt water gargles and drink warm fluids for inflammation","MCP hoarseness: rest vocal cords and avoid irritants (cigarette smoking, yelling, heartburn","Return if not improving in 3 days or immediately if worsening symptoms or red flags (above)."],
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

  C1ACT1 = [],
  C1ACT2 = [],
  C1ACT3 = [],
  C1DP1 = ["DP 2. These are symptoms that are related to volume depletion. Fluid depletion is a risk of significant nausea and vomiting. If a Soldier is not able to maintain fluid intake due to his or her nausea and vomiting, then short term hospitalization has to be considered until the nausea and vomiting can be controlled. Nausea and vomiting, especially in the mornings, is a common symptom in pregnancy. If a Soldier has a positive pregnancy test or symptoms of nausea during pregnancy, she will require a longer-term plan than the minor-care protocol can accommodate."],
  C1DP2 = [],
  C1DP3 = ["MCP for nausea/vomiting. Handwashing is important to prevent spread of disease. Due to contagion risk, activity modification is important for food handlers and multiple cases or when DFAC food is suspected must be reported to the supervising NCO due to the potential of an outbreak. Diet control is very important in treating nausea and vomiting. Ice chips should be used initially. Once vomiting is controlled, advance to clear liquids (broth, fruit juice, sports drink and caffeine free soda). Start with small sips and slowly advance. Once the Soldier has been able to tolerate liquids for 24 hours, advance to a BRAT (bread, rice, apple sauce, toast) diet of simple carbohydrates. The Soldier with severe or persistent vomiting that is unable to tolerate liquids will require IV fluids. Advise the Soldier to return for medical assistance if the symptoms last more than two days, if blood appears in his vomit or in his stools, or if he becomes dizzy and/or faints upon standing. Vomiting that is severe enough to prevent the Soldier from keeping clear liquids down for 24 hours, severe abdominal pain, or worsening symptoms are also causes for a prompt return visit."],
  C1DP4 = [],
  C1DPRE = ["DP 3. There are many other symptoms that can be associated with nausea and vomiting to include dizziness (vertigo), headaches (migraines) and heartburn. Reflux and regurgitation (return of gastric contents to hypopharynx with little effort) can be seen with heartburn and do not require treatment unless symptomatic."],
  C1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Vomiting blood/coffee grinds and melena can be signs of an intestinal bleed. Neurologic symptoms can be a sign of increased intracranial pressure. Myocardial infarction can present with nausea.","DP 1. These represent the possibility of more significant underlying medical conditions. A common side effect of chemotherapy treatment is nausea and vomiting that is sometimes difficult to control. BMI less than 18 can be a sign of an eating disorder like bulimia or another significant medical condition. Uncontrolled diabetes and gastroparesis due to diabetes can also present with nausea and vomiting."],
  C1PRO = ["Hand washing protocol. Special food handler precautions.","Notify supervising NCO if DFAC food is suspected or multiple cases identified.","Initiate a clear liquid diet with broth, sports drinks, clear non-caffeine soft drinks, fruit juice. ice chips to maintain calories and hydration. When vomiting controlled, start BRAT diet of simple carbohydrates.","Return to clinic if not improved in 48 hours or any of the red flags or other symptoms develop."],
  C1LIMITATIONS = ["No food handling, if work in a DFAC, until symptoms have resolved x 48 hours"],
  C1GEN = ["Pg. 51-52: Acute diarrhea in adults are often infectious in nature. The largest risk is due to volume depletion secondary to fluid loss. Small intestine infections often results in large, watery bowel movements associated with cramping, bloating, and gas symptoms. Large intestine infections often results in frequent regular, small bowel movements that are painful and associated with symptoms of mucous, blood, or fever. In general, diarrhea is often self-limited. Note that treatment of the symptoms by decreasing bowel movements frequency may extend the length of the disease."],
  C1MEDCOM = ["Administer Antiemetic pg. 67(3)(g)","Obtain Laboratory Specimens pg. 69-70(2)(k)"],
  C1STP1 = ["N/A"],


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
  C2GEN = ["Pg. 53-54: Acute diarrhea in adults are often infectious in nature. The largest risk is due to volume depletion secondary to fluid loss. Small intestine infections often results in large, watery bowel movements associated with cramping, bloating, and gas symptoms. Large intestine infections often results in frequent regular, small bowel movements that are painful and associated with symptoms of mucous, blood, or fever. In general, diarrhea is often self-limited. Note that treatment of the symptoms by decreasing bowel movements frequency may extend the length of the disease."],
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

  E1ACT1 = [],
  E1ACT2 = [],
  E1ACT3 = [],
  E1DP1 = ["DP 1. Urinary tract infections can get worse if not promptly treated. Urinary tract infection can progress to a kidney infection and then a systemic infection through the blood. Uncontrolled diabetes can present with increased urination and nausea with vomiting. Complaints requiring an invasive exam are referred to the supervising privileged provider."],
  E1DP2 = ["DP 2. Urinary complaints in a male are more likely to be something other than a urinary tract infection. Recurrent urinary tract infections (UTIs), recent urinary catheterization, and immunocompromised are more likely to have an atypical bacterial infection."],
  E1DP3 = ["MCP for UTI. Instruct the Soldier about the importance of increasing fluid intake to flush out the bacteria. OTC medication: phenazopyridine as needed for pain. Instruct the Soldier that it will likely dye his or her urine orange. It may also stain contact lenses from transferring the dye from the fingers to the contacts, if worn. Antibiotics: Trimethoprim/ Sulfamethoxazole is the first line agent. Nitrofurantoin is the second line agent if the Soldier is allergic to sulfa drugs or there is local resistance to the first line agent. Return to clinic if symptoms are not improving within 24 hours, development of new symptoms, or worsening symptoms despite treatment."],
  E1DP4 = [],
  E1DPRE = [],
  E1DPRED = [],
  E1PRO = [""],
  E1LIMITATIONS = [],
  E1GEN = ["pg. 69-70: Painful urination is most commonly a sign of a urinary tract infection, kidney stone, sexually transmitted infection, or yeast infection. Frequent urination can be associated with these but can also be one of the initial signs of hyperglycemia from diabetes. ","UA and urine culture should be completed if resources are available. A Soldier with symptoms consistent with a UTI can be empirically treated without a urinalysis after ruling out any history that would increase the Soldier’s risk and determining any allergies to medications."],
  E1MEDCOM = ["Obtain Laboratory Specimens pg. 69-70(2)(k)"],
  E1STP1 = [],

  E2ACT1 = ["Stress fracture: crutches with toe touching weight bearing"],
  E2ACT2 = ["STD Screen and UA"],
  E2ACT3 = [],
  E2DP1 = ["DP 2: Pain that has lasted for over 2 weeks is less likely to be an acute muscle strain and could represent an injury to the hip joint requiring further evaluation. Urologic symptoms, like hematuria, require further evaluation."],
  E2DP2 = ["MCP for epididymitis. Pain is often improved with testicular support. Instruct the Soldier on the importance of wearing supportive underwear (briefs, jock strap), application of ice to decrease the swelling. Medication: ibuprofen, acetaminophen, topical muscle balm, ice and heat as needed for pain, inflammation, and swelling or ketorolac for moderate pain. Activity modification.","MCP for muscle/tendon strain. Pain is often worse with activity. Instruct the Soldier on the home exercise program in accordance with local protocol. Medication: ibuprofen, acetaminophen, topical muscle balm, ice and heat as needed for pain, inflammation, and swelling or ketorolac for moderate pain. Activity modification.","MCP for urethral discharge. Request an order for a urinalysis and gonorrhea/chlamydia urine screen. If urethral discharge is present, 2+ white blood cells (WBCs) on urinalysis, leukocyte esterase positive on urinalysis, or recent known STI exposure, treat for potential gonorrhea/chlamydia infection with ceftriaxone and azithromycin. Instruct the Soldier that the condition is contagious and to abstain from intercourse for 1 week after treatment. Notify the supervising privileged provider so that he or she can track. Refer to community health. Return to clinic if symptoms are not improving within 48 hours, development of new symptoms, or worsening symptoms."],
  E2DP3 = [],
  E2DP4 = [],
  E2DPRE = [],
  E2DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems. ","DP 1: Severe pain at rest with the testes supported can be a sign of testicular torsion or a hernia. Immediate referral is needed for further evaluation and potential treatment. Pain with standing or increasing during exercise can be a sign of a stress fracture of the hip. Change in activity or endurance training are risk factors for a stress fracture. Suspected stress fractures should be toe touch weight bearing and get immediate evaluation. Nausea and vomiting could represent severe pain or be a sign of a hernia."],
  E2PRO = ["MCP FOR MSK:","Provide home exercise program, intermittent ice or heat IAW local protocol if worse with activity","MCP for epididymitis:","Intermittent ice and testicular support if improved with support","Activity modification as appropriate","Medication: Ibuprofen (1st line) and ketorolac (2nd line) as needed for moderate pain","Provide screening, treatment, and counseling if present with urologic symptoms.","RTC if worsening pain, new symptoms arise, or not improved within 1 week","MCP for urethral discharge:","Provide screening. if urethral discharge is present, or recent known STI exposure, treat for potential Gonorrheal/Chlamydia infection with ceftriaxone and azithromycin.","Instruct the Soldier that the condition is contagious and to abstain from intercourse for 1 week after treatment.","Notify provider, Refer to community health","RTC if symptoms are not improving within 48 hours, development of new symptoms or worsening symptoms"],
  E2LIMITATIONS = ["Epididymitis","Walk at own pace/distance","No running, jumping, riding in military vehicle over uneven terrain","May stand for up to 15min"],
  E2GEN = ["pg. 71-72: This term may be described as pain in the testes or groin. Look for visual cues and orient the Soldier to the pain scale prior to defining the level of pain."],
  E2MEDCOM = ["Initial Management of Fractures/Spinal Injury pg.69 (2)(d)","Obtain Laboratory Specimens pg.69-70 (2)(k)","Gathers Sexually Transmitted Infection Specimen pg.69-70 (2)(n)"],
  E2STP1 = [],

  E3ACT1 = ["STD Screen and UA"],
  E3ACT2 = [],
  E3ACT3 = [],
  E3DP1 = ["DP 2: Skin lesions/rash may represent a chancre (syphilis), HSV ulcers, genital warts (HPV), chancroid, or molluscum contagiosum. Further evaluation is necessary to determine the necessary treatment modality (freezing, medication, or referral)"],
  E3DP2 = ["MCP for urethral discharge. Request an order for a urinalysis and gonorrhea/chlamydia urine screen. If urethral discharge is present, 2+ WBC on urinalysis, leukocyte esterase positive on urinalysis, or recent known STI exposure, treat for potential gonorrhea/chlamydia infection with ceftriaxone and azithromycin. Instruct the Soldier to abstain from intercourse for one week after treatment due to contagious risk and counsel on safe sex practices and risks of high risk sexual behavior. Notify the supervising privileged provider so that he or she can track. Refer to community health. Return to clinic if symptoms are not improving within 48 hours, development of new symptoms, or worsening symptoms."],
  E3DP3 = [],
  E3DP4 = [],
  E3DPRE = [],
  E3DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: All Soldiers will be screened with a pregnancy test (if female), UA, and STI screen. STI screen will consist of a RPR, gonorrhea/chlamydia urine screen, and HIV screen. Pelvic pain with intercourse may be pelvic inflammatory disease. Orthostatic symptoms, fever, and signs of a severe illness can represent a more significant problem. Signs of a severe illness includes abnormal vital signs, appearing pale, sweaty, lethargic, or visually in pain. Failure of initial treatment may be a drug resistant organism. Females with vaginal symptoms to include discharge will be referred to a privileged provider for a pelvic examination."],
  E3PRO = ["Counsel on avoidance of sexual contact till diagnosis has been confirmed/ruled-out, safe sex practices, and risks of high risk sexual behavior.","STD Screen. Provide treatment with oeftriaxone and arithromycin if positive or symptomatic. Natty provider. Refer to community health.","RTC if worsening symptoms. new symptoms arise, or not improving within 2 days "],
  E3LIMITATIONS = [],
  E3GEN = ["pg. 73-74: Soldiers frequently show concern that they may have (STIs); however, they seldom use that term. For screening purposes, focus on the symptom(s), or in the absence of symptoms, the belief that they may have been exposed to infections through sexual contact. Sexually transmitted infections include but are not limited to those traditionally classified as venereal diseases. Some are potentially life-threatening; others are not. Some infections can be cured through treatment; others cannot be cured at the present time. Sometimes symptomatic relief is available. All Soldiers, with or without symptom(s), need to be evaluated."],
  E3MEDCOM = ["Obtain Laboratory Specimens pg.69-70(2)(k)","Gathers Sexually Transmitted Infection Specimen pg.69-70(2)(n)"],
  E3STP1 = ["Subject Area 15: Primary Care. Utilize a Urine Test Strip 081-833-0255"],

  E4ACT1 = ["Urinalysis, pregnancy test"],
  E4ACT2 = [],
  E4ACT3 = [],
  E4DP1 = ["DP 2: A man’s prostate can become enlarged later in life resulting in urinary symptoms of post-void urine dribbling, a weak stream, or difficulty initiating a urinary stream that requires further evaluation and treatment by a qualified provider."],
  E4DP2 = ["MCP for urethral discharge. See Protocol E-3. Check a first morning void urinalysis and gonorrhea/chlamydia urine screen. If indicated, treat for potential gonorrhea/chlamydia infection with ceftriaxone and azithromycin. Instruct the Soldier to abstain from sex due to the contagious risk. Notify the supervising privileged provider. Refer to community health. RTC if symptoms have not improved in 1 week, symptoms worsen, or new symptoms develop.","MCP for UTI. See Protocol E-1. OTC medication: phenazopyridine as needed for pain. Antibiotics: trimethoprim/sulfamethoxazole is the first line agent. Nitrofurantoin is the second line agent. Return to clinic in 24 hours if symptoms are not improving, worsening symptoms, or developing new symptoms.","MCP for urinary incontinence. If leaking urine during episodes of increased intra-abdominal pressure (sneezing, coughing, laughing, jumping), it is stress incontinence. Instruct the Soldier on performing Kegel exercises at home. Contact the clinic if not improving and would like a referral. Return for worsening or development of new symptoms."],
  E4DP3 = [],
  E4DP4 = [],
  E4DPRE = [],
  E4DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Inability to void can represent an obstruction of the ureter. Do to the risks to the kidneys, it is a medical emergency."],
  E4PRO = ["If urethral discharge is present, use SCP E-3","if UA is leukocyte esterase positive, 2+ WBCs, or UTI symptoms in a female, then use SCP E-1","if leaking urine when coughing, sneeing, jumping, counsel patient on home exercises.","RTC if worsening symptoms, new symptoms arise, or not improved within stated timeframe"],
  E4LIMITATIONS = ["For incontinence","Access to a restroom","No jumping"],
  E4GEN = ["pg. 75-76: Problems with voiding may include urinary incontinence (voiding unintentionally), difficulty initiating the urinary stream, decreased force of the stream, dribbling urination, complete inability to void."],
  E4MEDCOM = ["Obtain Laboratory Specimens pg.69-70(2)(k)","Gathers Sexually Transmitted Infection Specimen pg.69-70(2)(n)"],
  E4STP1 = ["Subject Area 15: Primary Care. Utilize a Urine Test Strip 081-833-0255"],

  F1ACT1 = ["Hypotensive - start IVF","Irregular pulse - EKG","Heat exposure - cool"],
  F1ACT2 = [],
  F1ACT3 = [],
  F1DP1 = ["DP 2: Anxiety with hyperventilation can result in dizziness. Soldiers with vertigo will require further evaluation and medications for treatment."],
  F1DP2 = ["MCP for syncope. Common reflex syncope situations include prolonged standing in formation, seeing/ giving blood, or especially stressful situation. Have the Soldier lay down in a comfortable position and elevate the legs, if possible. Continue to monitor the Soldier for 30 minutes after the symptoms have resolved. Reassure the Soldier that it is a common and benign condition. Instruct the Soldier to increase water and salt intake, watch for the prodromal signs (lightheaded, flushing/ feeling of warmth, sweating, tunnel vision/ changes in vision progressing to blindness, nausea, appearing pale), and actions to take when the symptoms start. Laying down with the legs raised or sitting when not able to lay down, clenching the fist, or leg pumping (crossing and flexing legs) or some ways that can help relieve symptoms."],
  F1DP3 = [],
  F1DP4 = [],
  F1DPRE = [],
  F1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Take orthostatic blood pressure. Severe headache associated with trauma can represent an intracranial bleed. Heat injuries can be life-threatening and require prompt action. Soldier acting abnormal or intoxicated, with abnormal pupils, an unsteady gait, loss of coordination, slurred speech, or appearing unkempt should be referred for further evaluation. Hypo/hyperglycemia can also result in altered mental status and progress to a coma."],
  F1PRO = ["Reflex syncope situation/symptoms before incident, have the patient lay down wth legs uncrossed and elevated until symptoms resolve. Observe the patient for 30 minutes after symptoms resolved to make sure that the symptoms do not return. Counsel the patient to increase electrolyte intake. Counsel the patient on situations that increase risk of reoccurrence, symptoms to watch for, and early interventions to take.","RTC if worsening symptoms, new symptoms arise, or recurrence of incident."],
  F1LIMITATIONS = ["No driving x 72 hours"],
  F1GEN = ["pg. 77-78: It is useful to try and distinguish among different presentations of dizziness: faintness, blackouts, vertigo, confusion, malaise, muscle weakness, and other sensations. True vertigo refers to an illusion where the room seems to be spinning about or the floor seems to be moving. It may be likened to the feeling experienced immediately after getting off a fast merry-go-round and is often accompanied by nausea. Faintness or light-headedness is a feeling of unsteadiness or beginning to fall. Blackout refers to a complete loss of consciousness and observers should also be questioned about potential causes of the event and any unusual observations during the event."],
  F1MEDCOM = ["Initiate an Intravenous Infusion pg.69(2)(a)","Initial Treatment of Environmental Injuries pg.69(2) ( e )","Provide Oxygen pg.69(2)(h)","Performs 12-lead Electrocardiogram pg. 69-70(2)(o-p)"],
  F1STP1 = ["Subject Area 12: Medical Treatment. Obtain an Electrocardiogram 081-833-3007","Subject Area 5: Venipuncture and IV Therapy. Initiate an Intravenous Infusion 081-833-0034","Subject Area 11: Force Health Protection. Initiate Treatment for a Heat Injury 081-833-0038"],

  F2ACT1 = [],
  F2ACT2 = [],
  F2ACT3 = [],
  F2DP1 = ["DP 2: Nausea is a common symptom with a migraine headache but can also be a sign of increased intracranial pressure. Nausea requires a further evaluation to determine the most likely cause. Uncontrolled high blood pressure can result in a headache and requires additional treatment. Headaches that have failed initial treatment need to be evaluated for secondary causes and a different medication regiment. A change from a Soldier’s usual headache can represent a more significant underlying medical problem or new cause of the headache. Pregnancy limits the medications that can be used, and headache in pregnancy could represent pre-eclampsia if over 20 weeks pregnant."],
  F2DP2 = ["MCP for headache. Provide the Soldier with ibuprofen, naproxen, or ketorolac as needed for his or her headache. Return to clinic if confusion, vision problems, nausea, or fever develop, if the pain is so severe that performance of normal duties is impossible, or the headache lasts over 24 hours. May provide physical activity modification for one day, if necessary."],
  F2DP3 = [],
  F2DP4 = [],
  F2DPRE = [],
  F2DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Severe hypertension is a blood pressure over 220 systolic or 110 diastolic. When a Soldier has severe hypertension, have them lay down in a quiet, dark room until able to transport them to a higher level of care. A blown pupil can be a sign of increased intracranial pressure. Sudden worst headache of the Soldier’s life and focal neurological sign can be a sign of an intracranial hemorrhage. Fever and inability to touch the chin the chest are signs of meningitis. Altered mental status can be a sign of a more significant problem. If there is some question as to whether or not the Soldier is confused, ask him simple questions such as his name, day of the week, the year, where he is now, or who is the President of the United States?"],
  F2PRO = [],
  F2LIMITATIONS = ["May wear Sunglasses Indoors"," Limit loud noises"," Walk at own pace/distance"," No running, rucking, jumping"],
  F2GEN = ["pg. 79-80: In the absence of fever, severe pain, or confusion, serious disease is extremely unlikely. Migraines often present with a gradual, increasing onset of a one sided, pulsatile moderate to severe headache worse with physical activity, noise, or light and associated with nausea and may have an aura. Tension-type headache often presents as a bilateral pressure that waxes and wanes lasting from 30 min to seven days. Cluster headache is rare. It presents with a rapid onset within minutes of unilateral deep, continuous severe pain around the eye or temple often associated with tearing, congestion, runny nose, pallor, or sweating."],
  F2MEDCOM = [],
  F2STP1 = [],



  F3ACT1 = ["Glucose < 70 - provide sugar/food if available"],
  F3ACT2 = [],
  F3ACT3 = [],
  F3DP1 = ["DP 2: Fatigue from an infectious illness can be described as weakness. First occurrence of symptoms or being 35 years old or older may indicate a higher risk for a more serious condition. Depression can also present as weakness."],
  F3DP2 = ["MCP for hyperventilation (respiratory rate greater than 14 per minute). Provide reassurance to the patient. Have the Soldier practice relaxed breathing. If symptoms do not resolve within 10 minutes, refer to AEM. If symptoms resolve, refer to behavioral health if available.","MCP for viral syndrome. Viral syndrome can present as fatigue described as weakness. It is a global feeling often associated with other symptoms and muscle aches. Treat in accordance with related protocol.","MCP for sleep issues. Sleep issues can present as fatigue described as weakness. It can be a manifestation of depression or stress among other things. Provide education on sleep hygiene, consider providing diphenhydramine or melatonin nightly for three nights, consider activity modification, discuss stress management, and offer a routine referral to behavioral health asset for counseling and treatment."],
  F3DP3 = [],
  F3DP4 = [],
  F3DPRE = [],
  F3DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Localized issue is more likely to have a serious cause then generalized symptoms. Back pain can represent a herniated disc causing nerve compression. Severe headache can represent an intracranial lesion. Insulin use, or history of diabetes can present with symptomatic hypoglycemia. In hypoglycemic Soldiers, sugar or food should be provided if available."],
  F3PRO = ["Hyperventilation: respiratory rate greater than 14 per minute. Provide reassurance to the patient. Have the Soldier practice relaxed breathing. If symptoms do not resolve within 10 minutes, refer to AEM. If symptoms resolve, refer to behavioral health if available. ","Viral Syndrome: ibuprofen as needed for fatigue/body aches. Drink plenty of water. Get plenty of sleep. ","Insomnia/Fatigue/Stress: provide sleep hygiene education, recommend self-reflection to find a way to relieve stress, and offer a routine referral to a routine behavioral health asset, if available. ","Return to clinic if not improving, new symptoms arise, or symptoms are worsening."],
  F3LIMITATIONS = ["For insomnia: Allow for 8 hours of uninterrupted sleep in 24 hour period","For Viral Syndrome: PT training at own pace/ rep/ distance x 3 days"],
  F3GEN = ["pg. 81-82: “Numbness” may be used by the Soldier to describe muscle weakness, malaise, confusion, or abnormal sensation including tingling (a “pins and needles” sensation). Paralysis/weakness is a condition that refers to a loss of muscular strength resulting in difficulty or inability to move a body part. A complete loss of muscular strength is paralysis; a partial loss is weakness."],
  F3MEDCOM = ["Obtain Blood Glucose Levels pg.69(2)(f)"],
  F3STP1 = ["Subject Area 15: Primary Care. Operate a Glucometer 081-833-0257"],
  
  F4ACT1 = ["Glucose < 70 - provide glucose","SpO2 <90 - start oxygen","H/O alcohol - give thiamine","H/O narcotics - give naloxone"],
  F4ACT2 = ["Check rectal temp if heat exposure concern"],
  F4ACT3 = [],
  F4DP1 = ["DP 2: Sudden onset of symptoms is more concerning. Heat exhaustion, heat injury, and heat stroke can be associated with drowsiness or confusion. If a heat exposure is of concern, then a rectal temperature must be checked. Alternative methods of checking the temperature can be inaccurate. Alcohol, drug, or medication exposure or withdrawal can cause drowsiness. Some medications that can cause drowsiness include antihistamines, sleep medications, muscle relaxants, analgesics, and psychiatric medications."],
  F4DP2 = ["If drowsiness or confusion is not from a condition below, refer to AEM.","MCP for viral syndrome. Viral syndrome can present as fatigue described as drowsiness. It is a global feeling often associated with other symptoms and muscle aches. Treat with ibuprofen as needed for fatigue/body aches. Treat other symptoms in accordance with the corresponding minor-care protocol.","MCP for sleep problems. Sleep issues can present as fatigue described as weakness. It can be a manifestation of depression or stress among other things. Provide education on sleep hygiene, consider providing diphenhydramine or melatonin nightly for three nights, consider activity modification, discuss stress management, and offer a routine referral to behavioral health asset for counseling and treatment."],
  F4DP3 = [],
  F4DP4 = [],
  F4DPRE = [],
  F4DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Abnormal vital signs may represent a more significant condition to include shock. Soldiers with an altered mental status should have their finger stick blood sugar checked. Hypoglycemia can cause an altered mental status. Focal neurological deficits and a recent trauma suggest intracranial pathology. Alcohol, narcotics, and other drugs can cause confusion through intoxication or withdrawal. Seizures can cause confusion even if the rhythmic jerking movements are not presenting in the Soldier."],
  F4PRO = ["Viral Syndrome: ibuprofen as needed for fatiguerbody aches. Drink plenty of water. Get plenty of sleep. Screen other symptoms as needed.", "Insomnia/fatigue/Stress: provide sleep hygiene education, consider providing melatonin or activity modification, recommend self-reflection to find a way to relieve stress. and offer a routine referral to a behavioral health asset. if available. ","Return to clinic if not improving. new symptoms arise, or symptoms are worsening."],
  F4LIMITATIONS = ["Allow for 8 Hours of uninterrupted sleep in any given 24 hour period"],
  F4GEN = ["pg. 83-84: Drowsiness and confusion are symptoms that may be observed even when the Soldier is relating other complaints. Drowsiness and confusion may be related to many underlying issues to include systemic illness, organ dysfunction, drug intoxication/ withdrawal, psychiatric illness, trauma, or neurologic illness."],
  F4MEDCOM = ["Obtain Blood Glucose Levels pg.69(2)(f)","Provide Oxygen pg.69(2)(h)","Obtain Laboratory Specimens pg.69-70(2)(k)"],
  F4STP1 = ["Subject Area 15: Primary Care. Operate a Glucometer 081-833-0257","Subject Area 4: Airway Management. Administer Oxygen 081-833-0158"],

  F5ACT1 = ["Inform leadership","Do not leave Soldier alone","Remove means of self-harm"],
  F5ACT2 = ["Obtain list of all medications and amount taken","Ask if currently receiving BH services"],
  F5ACT3 = [],
  F5DP1 = ["DP 2: Ask the following questions for a depression screen: Over the past 2 weeks, have you often been bothered by feeling down, depressed, or hopeless? Over the past 2 weeks, have you often been bothered by having littler interest or pleasure in doing things? In addition to other situational, mental health, or medical causes, emotional distress may accompany injury and/or chronic pain and may merit a referral to behavioral health services. Ask Soldier how he or she is coping with the injury and/or pain. Other indicators of emotional distress may include disheveled appearance or poor hygiene, reported change in work performance, and risk-taking behavior. Obtain a list of all medications and the amounts taken to provide to the AEM. Taking significantly more of a medication than the prescribed amount may represent a suicidal gesture and should be inquired about if reported. If the Soldier was accompanied to the screening area by an escort, it may be due to high risk behavior or safety concerns. Inquire as to reason for escort, asking escort if necessary."],
  F5DP2 = ["MCP for decreased mood. Soldiers that are experiencing mood symptoms that are mild in nature and not associated with other symptoms or impairment should be offered assistance. As always, remain calm, express concern for the Soldier, and do not be judgmental or argumentative. Educate the Soldier on the many resources that are available in your area, to include: Behavioral Health, Chaplaincy, Army Community Services, Chain of Command, Military and Family Life Consultants, Military OneSource, and Army Wellness Center. Offer to walk the Soldier to the resource that they prefer. Do not allow the Soldier to leave the screening area until they have been cleared by the supervising medic."],
  F5DP3 = [],
  F5DP4 = [],
  F5DPRE = [],
  F5DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “provider now.” These can be signs of significant underlying medical or serious behavioral health problems.","DP 1: Ask the following questions: In the past month, have you wished you were dead or wished you could go to sleep and not wake up? Have you had any thoughts about killing yourself? If YES to the second question, ask: Have you thought of how you might do this? Have you started to work out or have worked out the details of how to kill yourself? Do you have any intention of acting on these thoughts of killing yourself? Remain calm. Express concern and do not be dismissive. Do not be judgmental or argumentative. If YES to questions about suicidality, do not leave the Soldier alone. Remove means of self-harm. Do not leave the Soldier waiting alone for a long time in a busy waiting room, as this may increase the Soldier’s distress. Be aware that abnormal vital signs and/or anxiety or depression symptoms may represent an underlying medical issue."],
  F5PRO = ["Must get cleared by the supervising medic prior to the Soldier leaving the screening area.","Offer assistance through Behavioral Health, Chaplain, Chain of Command Army Community Services, Military and Family Life Consultants, Military OneSource, or Army Wellness Center. ","Offer to escort the Soldier to the service."],
  F5LIMITATIONS = ["Escort to Behavioral Health or Emergency Room"],
  F5GEN = ["pg. 85-86: The terms “depression, nervousness, anxiety, tension” and complaints of “nerves” or “being upset” may all be used by Soldiers to describe problems with mood. Complaints such as these are often due to situational or behavioral health factors, but may also be due to a physical condition. Everyone experiences emotional distress from time to time. However, when symptoms become continuous or interfere with daily functioning, or when suicidal or homicidal thoughts or self-harm are reported, the complaint must be taken seriously and further evaluated."],
  F5MEDCOM = ["N/A"],
  F5STP1 = ["Subject Area 6: Primary Care. Provide Treatment for a Behavioral Emergency 081-833-0246"],
  
  F6ACT1 = [],
  F6ACT2 = [],
  F6ACT3 = [],
  F6DP1 = ["DP 2: A MACE 2 cognitive score less than or equal to 25, any abnormality on the neurological exam, any abnormality on the VOMS exam, presence of one or more symptoms, observed loss or alteration of consciousness, or a history of TBIs require additional evaluation and treatment."],
  F6DP2 = ["MCP for mTBI. MACE 2 screening that does not identify a concussion (screens negative) can be managed with reviewing the Acute Concussion Educational Brochure with Soldier, a mandatory 24 hour rest period followed by a re-evaluation after the 24 hour rest period prior to the Soldier returning to duty. Re-evaluation should include exertional testing if the Soldier is still asymptomatic. Exertional testing increases the cardiac output (blood pressure and heart rate) which can worsen symptoms by increasing swelling if present. Return to the clinic if symptoms worsen or new symptoms develop. More information is available at https://dvbic.dcoe.mil.","Concussion treatment is guided by the results of the symptom cluster assessment generated by the MACE 2. A MACE 2 screening that identifies a concussion (screens positive) should prompt a minimum of 24-hour rest, with follow-up every 24 to 48 hours up to seven days. Additionally, concussions should be managed by initiation of the concussion management tool (CMT) and progressive return to activity (PRA) by a medical provider or other trained medical staff member. Results from the MACE 2 align to specific treatment protocols embedded within the CMT. Rapidly addressing vestibular and oculomotor deficits identified by the MACE 2 and daily evaluation of progress with the PRA will lead to faster recovery. The new MACE 2, CMT and PRA are enclosed in the appendix."],
  F6DP3 = [],
  F6DP4 = [],
  F6DPRE = [],
  F6DPRED = ["Red Flags. If the Soldier presents with any red flag, immediately disposition the Soldier as “Provider Now” as these can be signs of medical emergencies.","DP 1: All Soldiers with a possible mTBI should be screened using the Military Acute Concussion Evaluation, version 2 (MACE 2) exam and results should be documented on the Soldier’s medical record. The MACE 2 assesses for red flags and the five predominate concussion sub-types (vestibular, oculomotor, headache/migraine, anxiety/mood, and cognitive).","Presence of the following observable signs are suggestive of a concussion and prompt thorough evaluation: (1) lying motionless on the ground, (2) slow to get up after a direct or indirect blow to the head, (3) disorientation, confusion or inability to respond appropriately to questions, (4) blank or vacant look, (5) balance difficulties, stumbling, or slow labored movements, and (6) facial injury after head trauma.","A positive initial screening on the MACE 2 indicates a concussive injury and often presents as alteration of consciousness (seeing stars, dazed, confused), loss of consciousness, or amnesia (trouble remembering the event). Positive screening with the following are recommended for a CT scan of the head: deteriorating level of consciousness, double vision, increased restlessness, combative or agitated behavior, severe or worsening headache, mental status (GCS<15), suspected skull fracture, sign of basilar skull fracture (hemotympanum, raccoon eyes, Battle sign, oto-/rhinorrhea), 2+ episodes of vomiting, amnesia for 30+ minutes before incident, neurologic deficit, seizure, severe incident (hit by motor vehicle, ejection from vehicle, fall >3 feet/ >5 stairs), or on an anticoagulant.","The MACE 2 encompasses the following key areas: (1) concussion screening, (2) history questions (related to anxiety, migraine, and cervicogenic assessment), and (3) neurological, cognitive, and vestibular/oculomotor assessments. The neurological assessment includes speech fluency, word finding, single leg stance, tandem gait, pronator strength and eye tracking. The cognitive section includes scored evaluations of orientation and immediate and delayed recall. The vestibular/ocular-motor screening (VOMS) is a symptom-provoking exam that is necessary to detect patients at risk for delayed recovery due to oculomotor and vestibular deficits. Symptoms assessed are headache, dizziness, nausea, and fogginess."],
  F6PRO = ["All positive MACE 2 screens should be referred to the AEM or Provider for further evaluation","Negative MACE 2 24 hour rest period, review Acute Concussion Educational Brochure with patient. and counsel Soldier to return after 24 hour rest for re-evaluation If no symptoms. perform exertional testing","Return to Clinic if worsening symptoms, new symptoms","More information is available at https://dvbic.dcoe.mil","See Appendix for MACE 2 card, CMT, and PRA resources"],
  F6LIMITATIONS = ["Use the Concussion Management Tool (CMT) and associated Progressive Return to Activity (PRA) for specific management. A minimum of 24 hour rest, defined as:","1. Rest with extremely limited cognitive activity","2. Limit physical activities to those of daily living and extremely light leisure activity","3. Avoid working, exercising, playing video games, studying, or driving","4. Avoid any potentially concussive events","5. Avoid caffeine and alcohol","Reassess using the MACE 2 after 24 hours rest"],
  F6GEN = ["pg. 87-89: More information is available at https://dvbic.dcoe.mil. minor traumatic brain injury (mTBI) or concussion is an injury to the brain that may result after blunt force, an acceleration/deceleration head injury (whiplash), or exposure to a blast wave (close contact or prolonged duration such as a firing range). In addition, mild TBIs are defined by at least one of the following clinical signs immediately following the event: alteration of consciousness lasting <24 hours, loss of consciousness <30 minutes, or post-traumatic amnesia <24 hours. CT scans are not indicated for most patients with concussion, but if obtained, the results are typically normal."],
  F6MEDCOM = ["N/A"],
  F6STP1 = ["Subject Area 6: Primary Care. Perform a Military Acute Concussion Evaluation 2 (MACE 2) Screening for mild Traumatic Brain Injury 081-833-0247"],

  G1ACT1 = [],
  G1ACT2 = [],
  G1ACT3 = ["MCP for fatigue. Advise the Soldier that vitamins are rarely helpful, that “pep pills” do not work (the rebound usually makes the problem worse), and that tranquilizers generally intensify fatigue. Taking a vacation, if possible, or undertaking new activities are often helpful.","Helpful Actions Include: Identifying potential sources of the fatigue such as work stress, marital discord, lack of rest or sleep (either quantity or quality of sleep), or a poor/not well balanced diet. Provide information on proper sleep hygiene and refer to sleep hygiene course if locally available. If not a suicidal risk (which would require immediate referral) suggest various available options for counseling, including behavioral health, Army community services, and the chaplain. Work on the problem rather than on the symptom.","Seek medical assistance if symptoms worsen, other symptoms develop, fatigue makes normal activities difficult, difficulty staying awake while driving, or not improved within one week.","MCP for sleep problems. Sleep issues can present as fatigue described as weakness. It can be a manifestation of depression or stress among other things. Provide education on sleep hygiene, consider providing diphenhydramine or melatonin nightly for three nights, consider activity modification, discuss stress management, and offer a routine referral to behavioral health asset for counseling and treatment."],
  G1DP1 = [],
  G1DP2 = [],
  G1DP3 = [],
  G1DP4 = [],
  G1DPRE = ["DP 2. If the Soldier has other specific complaints or symptoms, the Soldier should be evaluated for that complaint. Otherwise, the minor-care protocol is appropriate."],
  G1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of medical emergencies.","DP 1. While fatigue is often not caused by a specific disease, it may be a presenting symptom of a potentially serious condition. Depression may only present as fatigue. Decreased libido could be a sign of an adrenal/pituitary issue. Weight change could represent hypo/hyperthyroidism. Menorrhagia often results in anemia. Snoring can be a sign of sleep apnea. USPSTF Screening/PHA is to look at age appropriate cancer and cardiovascular screening. Infections, inflammation, liver/kidney disease, and medication/drug use can also cause fatigue."],
  G1PRO = ["OTC Medication: diphenhydramine to assist with sleep if needed","Referral: Wellness Center for relaxation exercises for stress, ACS for anger management, Behavioral Health or Chaplain for stress or support","Return if not improving in 1 week or immediately if Red Flags, development of new symptoms, or inability to perform daily activ ties."],
  G1LIMITATIONS = ["Allow for 8 hours of uninterrupted sleep with a 24 hour period"],
  G1GEN = ["pg. 90-91: Fatigue is a state of increased demand/stress on the body or decreased efficiency."],
  G1MEDCOM = ["N/A"],
  G1STP1 = ["N/A"],

  G2ACT1 = [],
  G2ACT2 = [],
  G2ACT3 = [],
  G2DP1 = [],
  G2DP2 = ["MCP for elevated temperature. Instruct the Soldier to stay well hydrated and get plenty of rest. He or she should drink fluids to keep their urine mostly clear and obtain at least eight hours of rest per day. Take acetaminophen as needed for temperature above 98.4°F (No more than eight tablets within 24 hours. No other medications with acetaminophen in them. No alcohol.)","Soldier is contagious while he or she has an elevated temperature. He or she should avoid contact with healthy Soldiers as much as possible. If in training, refer to local SOP. Soldier may need to be placed in quarters. Return for medical assistance if symptoms do not improve with acetaminophen, other symptoms develop, or a fever develops (T > 100.4)."],
  G2DP3 = [],
  G2DP4 = [],
  G2DPRE = ["DP 2. Before assuming the Soldier has isolated fever/chills, be sure to ask him/her specifically about other symptoms such as upper respiratory infection symptoms, cough, sore throat, ear pain, diarrhea, dysuria, rash, and muscle aches. If no associated symptoms can be identified, over half of Soldiers’ fever will resolve on its own without an underlying issue being identified."],
  G2DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of medical emergencies.","DP 1. If the Soldier’s temperature is greater than 100.4°F, has symptoms for more than 48 hours, HIV infection, or immunosuppression, then there is a greater risk of the fever being caused by a bacterial infection. Overseas travel, tick or mosquito bite, animal exposure, and malaria endemic area, increase the risk of a zoonotic or malaria infection. IV drug use increases the risk of endocarditis."],
  G2PRO = ["OTC Medication: acetaminophen as needed for elevated temperature (No other medications with acetaminophen. No alcohol.), ibuprofen as needed for malaise.","Stay hydrated by drinking fluids to keep your urine mostly clear. Get plenty of rest.","Return if red flags, new symptoms. lasts longer than 48 hours, or fever not controlled with acetaminophen"],
  G2LIMITATIONS = ["For a Fever: Consider Quarters x 24-48 hours (must discuss with supervising privileged provider)"],
  G2GEN = ["pg. 92-93: Fever/chills are usually associated with an acute illness with other obvious symptoms."],
  G2MEDCOM = ["N/A"],
  G2STP1 = ["N/A"],

  H1ACT1 = ["Chemical - irrigation","Foreign body - fox shield","Head trauma - stabilize neck","Other - cover eye"],
  H1ACT2 = [],
  H1ACT3 = [],
  H1DP1 = ["DP 2. Thick, yellow or green discharge that continues throughout the day suggests bacterial conjunctivitis. Eye pain, light sensitivity, inability to open or keep the eye open, and foreign body sensation suggests a corneal or intraocular inflammatory process. Fast moving metal or glass slivers from an explosion or welding can penetrate the eye with symptoms that rapidly disappear. A history of a foreign body that is now “getting better” should be screened as a foreign body."],
  H1DP2 = ["MCP for blepharitis (crusting of the eye in the morning with or without red, swollen eyelids). Treatment is washing of the eyelashes daily with washcloth using warm water and non-tearing baby shampoo, warm compresses, lid massage. Instruct to avoid lotions, creams, make-up to the affected area. RTC if worsening or not improving within one week.","MCP for dry eyes (tearing, blurry vision that clears with blinking, and a gritty sensation). Treatment is artificial tears as needed (prn).","MCP for viral, allergic conjunctivitis (crusting, watery discharge with burning (viral) or itching (allergic)). Viral is highly contagious. Treatment is with warm or cool compresses and topical antihistamine/decongestant drops.","MCP for subconjunctival hemorrhage. Further evaluation is necessary when associated with trauma, is recurrent, or Soldier is on an anticoagulant."],
  H1DP3 = [],
  H1DP4 = [],
  H1DPRE = [],
  H1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of medical emergencies.","DP 1. Perform an eye exam with visual acuity. Do not perform a fluorescein exam if concerned for an open globe. Cover the eye with an unpadded protective fox shield or cup and discuss with the supervising privileged provider if a potential foreign body. A privileged provider order is required to irrigate the eye except when immediate irrigation is required for a chemical exposure. A white or red layered fluid level over the iris is a sign of a hypopyon or hyphema, respectively, requiring emergent referral. Contact lens, recent eye surgery, and fluorescein uptake increase potential of a serious condition."],
  H1PRO = ["Stye treated with warm compress x 15min, 4x/day followed by massaging area. ","Blepharitis treated with warm compresses (like stye), avoidance of make-up, and washing with warm water and tear free shampoo. ","Dry eyes are treated with artificial tears lubricating drops as needed. ","Viral, allergic conjunctivitis is treated with warm or cool compresses, topical antihistamine/ decongestant drops, and contagion precautions. ","Subconjunctival hemorrhage is a demarcated area of blood (outside of the iris) with normal visior no discharge, light sensitivity, or foreign body sensation. Typically resolves in 1-2 weeks. ","Do not perform fluorescein exam if there is concern for an open globe or ruptured eye."],
  H1LIMITATIONS = [],
  H1GEN = ["pg. 94-95: Eye pain, redness, discharge, itching, and injury includes trauma to common inflammatory and infectious conditions."],
  H1MEDCOM = ["Administer Ophthalmic Medication pg.67(3)( c)","Examines Eye Using Fluorescein Strip pg.69(2)(i)"],
  H1STP1 = ["Subject Area 18: Medication Administration. Administer Eye Medications 081-833-0015"],

  H2ACT1 = ["Fox shield/ protective cover","Head trauma - stabilize neck"],
  H2ACT2 = [],
  H2ACT3 = [],
  H2DP1 = ["DP 2. Significant redness and swelling can be signs of cellulitis. Cellulitis is a relatively common complication of a stye. It requires further evaluation and treatment with oral antibiotics. Dermatitis and some systemic diseases can also present with an eyelid rash requiring further evaluation and treatment."],
  H2DP2 = ["MCP for stye. Presents with redness, tenderness, and swelling of the eyelid. Initial treatment should be a warm compress placed on the area for 15 min four times per day with massage of the area after the warm compress. Return to clinic if becomes significantly painful, redness and swelling spreads, or not improving within one week.","MCP for chalazion. Presents with painless swelling of the eyelid. It is treated the same way as a stye and usually resolves within a couple of weeks.","MCP for blepharitis. Presents with bilateral crusting of the eye in the morning and may be associated with red, swollen eyelids, and dry eyes that improve with blinking. Treatment is washing of the eyelashes daily with washcloth using warm water and non-tearing baby shampoo, warm compresses, lid massage. Instruct to avoid lotions, creams, make-up to the affected area. RTC if worsening or not improving within one week.","MCP for contact dermatitis. Skin reaction from an irritant. In a female, make-up is the most common cause. Evaluate for any new exposures, other areas involved. Instruct to avoid the most likely contact/cause and any lotions, creams, or soaps with perfumes, hair dyes, new shampoos, and eye make-up. Use hydrocortisone cream with precautions to avoid getting it in the eye."],
  H2DP3 = [],
  H2DP4 = [],
  H2DPRE = [],
  H2DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of medical emergencies.","DP 1. Assess for life-threatening injuries (head, neck, airway) before performing an eye exam with visual acuity. Access for signs of an open globe. Laceration of full thickness of eyelid, with orbital fat prolapse, through lid margin, involving lateral/medial/tear duct/or muscles, or associate with avulsion or malalignment requires referral. Decreased visual acuity and double vision along with pain, fixed pupil, and swelling around the eye are signs of a potential internal eye injury. Orbital compartment syndrome can develop which is a medical emergency requiring immediate treatment."],
  H2PRO = ["Stye, chalazion is treated with warm compress x 15min, 4x/day followed by massaging area.","Blepharitis is treated with warm compresses (like stye), avoidance of make-up, and washing with warm water and tear free shampoo.","Contact dermatitis is treated with avoidance of the exposure and hydrocortisone ointment 1% twice a day for 1 week.","Return to clinic if the condition is worsening, new symptoms develop, or it is not improving within 1 week."],
  H2LIMITATIONS = [],
  H2GEN = ["pg. 96-97: Eyelid problems include serious effects of trauma to simple conditions of inflammation."],
  H2MEDCOM = ["Administer Ophthalmic Medication pg.67(3)( c)"],
  H2STP1 = ["Subject Area 18: Medication Administration. Administer Eye Medications 081-833-0015"],

  H3ACT1 = ["Fox shield/protective cover","Head trauma- stabilize neck"],
  H3ACT2 = [],
  H3ACT3 = [],
  H3DP1 = ["DP 2. Wearing contacts increases the risk of keratitis and corneal abrasion. Fluorescein exam is the next step to evaluate for these causes. Visual acuity of contact wearer should be performed with and without glasses to evaluate for a change in vision not related to the contacts. Acute onset and pain are signs of a more concerning cause than the need for glasses. Migraine can be associated with temporary decreased vision or seeing spots prior to a headache (an aura)."],
  H3DP2 = ["MCP for decreased vision. Visual acuity worse than 20/40 requires a referral to optometry for evaluation for glasses. Worsening of the vision is gradual and often occurs in both eyes. Noticing the issue may occur with a specific activity like trying to read a sign, seeing a target at the range, or Soldier may present requesting an evaluation or been screened during a yearly readiness screening. (Note: protective mask inserts are not usually provided to personnel with uncorrected vision of 20/40 or better). Floaters are clumps of material in the gel-like substance in the back of your eye. They are common, benign and move around in your field of vision. They are not fixed to a particular location in the field of view or significantly obstruct the field of view."],
  H3DP3 = [],
  H3DP4 = [],
  H3DPRE = [],
  H3DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of medical emergencies.","DP 1. Perform an eye exam with visual acuity. Decreased visual acuity following trauma may indicate a serious injury that requires immediate treatment. Retinal detachment is often preceded by flashes of light, new floaters, and black spots, these symptoms should prompt a dilated retinal exam as soon as possible by an eye care provider. A foreign body seen on exam should not be removed. Cover the eye with a protective fox shield or cup and discuss with the supervising privileged provider. A privileged provider order is necessary prior to irrigation of a foreign body except when immediate irrigation is required for a chemical exposure. A white or red layered fluid level over the iris is a sign of a hypopyon or hyphema, respectively, and requires emergent referral. If the decreased vision involves a distinct part of the visual field which includes a black spot that moves with your eye, the cause may be serious."],
  H3PRO = ["Decreased visual acuity worse than 20/40: Gradual Onset. Refer to optometry for evaluation for glasses. ","Floaters are common and benign. Provide reassurance. ","Return to clinic if the condition is worsening or new symptoms develop."],
  H3LIMITATIONS = [],
  H3GEN = ["pg. 98-99: Decreased vision can mean that images are less distinct or that a portion of the visual field is “blacked out.” The Soldier may refer to the spots as stars, flashes, or floaters."],
  H3MEDCOM = ["Initial Management of Fractures/Spinal Injury pg.69(2)(d)"],
  H3STP1 = ["Subject Area 6: Primary Care. Perform Visual Acuity Testing 081-833-0193","Subject Area 3: Trauma Treatment. Apply a Cervical Collar 081-833-0177"],

  H4ACT1 = ["Head trauma - stabilize neck"],
  H4ACT2 = [],
  H4ACT3 = [],
  H4DP1 = ["  DP 2. Cover one of the patient’s eyes and then the other, assessing whether the double vision persists or not. If double vision continues despite having one eye shut or if double vision is a new issue, the Soldier will need to be referred to an eye care provider (ophthalmologist or optometrist)."],
  H4DP2 = ["MCP for seeing double. A long-standing history of double vision or double vision caused by new eyeglasses may well indicate a need for evaluation of the eyeglass prescription. The Soldier should be given an appointment at the optometry clinic. Soldier should not drive a vehicle, fire a weapon, or perform other duties requiring depth perception."],
  H4DP3 = [],
  H4DP4 = [],
  H4DPRE = [],
  H4DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of medical emergencies.","DP 1. Assess for potential life-threatening injuries (head, neck, and airway) before accessing for vision issues. If the double vision is related to a recent trauma to the head, neck, or back, then it may represent a serious injury to the brain. Neurologic deficits (trouble walking, talking) can indicate a serious problem requiring immediate evaluation."],
  H4PRO = ["Long-standing history or started with new eyeglasses, refer to optometry and patch the eye for symptomatic relief. No driving a vehicle, firing a weapon, or other duties requiring depth perception unti the Soldier has been evaluated by an optometrist.","Return to clinic if symptoms worsen or new symptoms develop."],
  H4LIMITATIONS = ["No Driving"," No Firing Weapon"," No Duties Requiring Depth Perception"],
  H4GEN = ["pg. 99-100: Double vision means seeing two images of a single object."],
  H4MEDCOM = ["Initial Management of Fractures/Spinal Injury pg.69(2)(d)"],
  H4STP1 = ["Subject Area 6: Primary Care. Perform Visual Acuity Testing 081-833-0193","Subject Area 3: Trauma Treatment. Apply a Cervical Collar 081-833-0177"],

  I1ACT1 = [],
  I1ACT2 = [],
  I1ACT3 = [],
  I1DP1 = ["DP 2: Testosterone supplementation in exercise supplements can result in enlargement of breast tissue under the nipple. Enlarged breast tissue can be painful, especially when wearing body armor, further evaluation and counseling are warranted. Nursing mothers often have problems with cracked or infected nipples or have difficulty when the child is weaned, but further examination is required to rule out more concerning issues. Pain without other concerns that is not related to breastfeeding weaning, exercise, or cyclical pain with menstrual cycle requires further evaluation and may require imaging."],
  I1DP2 = ["MCP for breast pain. Women with a large amount of breast tissue can have discomfort associated with stretching of Cooper’s ligaments. It can be associated with shoulder, back, or neck pain and made worse with exercise. Educate the Soldier on the importance of supportive undergarments, ice compress/heat compress for inflammation, acetaminophen as needed for mild pain, and ibuprofen (1st line) or ketorolac (2nd line) as needed for moderate pain.","MCP for chest extramammary/musculoskeletal pain. Related to the chest wall and not the breast tissue. Ice/ heat compresses as needed for inflammation. Medication: mentyl salicylate (1st line) or acetaminophen (2nd line) as needed for mild pain, and ibuprofen (1st line) or ketorolac (2nd line) as needed for moderate pain. Activity modifications should be considered as appropriate.","MCP for diffuse breast pain. Diffuse breast pain is unlikely to be related to cancer. Provide reassurance. If the Soldier is concerned about the possibility of breast cancer after reassurance, refer to provider for consideration of an imaging study to provide reassurance. Treat discomfort with ice/heat (1st line) or acetaminophen (2nd line) as needed for mild pain and ibuprofen (1st line) or ketorolac (2nd line) as needed for moderate pain."],
  I1DP3 = [],
  I1DP4 = [],
  I1DPRE = [],
  I1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be an indication of significant underlying medical problems.","DP 1: Skin changes, mass, or bloody nipple discharge are concerning symptoms that require further evaluation and imaging. Red, swollen breast can represent mastitis or an abscess that requires further evaluation and treatment."],
  I1PRO = ["Large breasts: educate the patient on importance of physical support (well-fitting bra). Ice' heat (1st line) or acetaminophen (2nd line) as needed for mild pain. Ibuprofen (1st line) or ketorolac (2nd line) as needed for moderate pain.","extramammary/Muskuloskletal pain: ice, heat for inflamma: rpettgly) salicylate (1st line) or acetaminophen (2nd line) as needed for mild pa profen (1st line) or ketorolac (2nd line) as needed for moderate pain. Activity modification as needed.","Female diffuse breast pain: ice/heat for inflammation. menthyl salicylate (1st line) or acetaminophen (2nd line) as needed for mild pain. ibuprofen (1st line) or ketorolac (2nd line) as needed for moderate pain. Provide reassurance. Refer to provider if Soldier is concerned about risk of breast cancer after reassurance.","RTC if not improving within 3 days. worsening symptoms. or development of new symptoms."],
  I1LIMITATIONS = ["No running, jumping, rucking","Walk at own pace/ distance","May lift, carry, push up to 25 lbs"],
  I1GEN = ["pg. 102-103: Breast pain can represent musculoskeletal pain, cyclic pain, or pain associated with inflammation or infection. It is rarely associated with cancer."],
  I1MEDCOM = ["N/A"],
  I1STP1 = ["N/A"],

  I2ACT1 = [],
  I2ACT2 = [],
  I2ACT3 = [],
  I2DP1 = ["DP 2: Refer Soldiers with a positive pregnancy test to the AEM. The Soldier will need to receive initial pregnancy counseling that includes medications and foods to avoid, importance of a daily prenatal vitamin, avoidance of alcohol, pregnancy profile, and referral to obstetrics-gynecology clinic. These services are also sometimes provided by the clinic nurse depending on local protocol."],
  I2DP2 = ["There are multiple causes of a late cycle that are unrelated to pregnancy to include birth control medications, increasing exercise regimen, and stress. Average menstrual cycle is 28 days but can range from 24 to 38 days. Instruct the Soldier to avoid alcohol and NSAID medications (to include Ibuprofen, naproxen, or ketorolac). Return to the clinic in one week if she still has not had a cycle."],
  I2DP3 = [],
  I2DP4 = [],
  I2DPRE = [],
  I2DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” They can be signs of significant underlying medical problems.","DP 1: Check a urine hCG. If the urine hCG is negative, confirm negative with a serum hCG. Positive hCG with pelvic pain or history of a prior ectopic pregnancy increases the possibility of an ectopic pregnancy. Vaginal bleeding suggests a possible miscarriage or complication of pregnancy."],
  I2PRO = ["Counsel the Soldier to avoid alchol and NSAID medications","Return to clinic in 1 week if she still has not had a cycle"],
  I2LIMITATIONS = [],
  I2GEN = ["pg. 104-105: Women who believe that their menstrual cycles are late should be evaluated with a pregnancy test. Urine human chorionic gonadotrophin (hCG) tests have improved over the years and provide results much quicker than in the past. A urine hCG obtained greater than seven to eight days after conception should be positive."],
  I2MEDCOM = ["Obtain Laboratory Specimens pg.69-70(2)(k)"],
  I2STP1 = [],

  I3ACT1 = [],
  I3ACT2 = [],
  I3ACT3 = [],
  I3DP1 = ["DP 2: Most common problems are irregular and painful periods. Menstrual pain starting after age 25, progressive worsening of symptoms, and poor relief with Ibuprofen are symptoms of a secondary cause to include adenomyosis, endometriosis, or fibroids. Spotting on Depo-Provera, Nexplanon, or IUD is not uncommon but should be examined further. Menses lasting for over five days, more often than every 21 days or less often than 35 days, or bleeding in between menses is considered abnormal. Soaking a pad or tampon more often than every two hours or interferes with daily activities is considered heavy."],
  I3DP2 = ["MCP for Painful Menstrual Cycles. Bothersome menstrual cramping (dysmenorrhea) usually lasts about 24 hours. It may be relieved by naproxen or ibuprofen for 5-7 days. Ketorolac can be used on presentation for moderate pain. Seldom is discomfort such that the Soldier is unable to perform normal activities. Give the Soldier symptomatic medication and instructions for use. Instruct the Soldier to return if the symptoms are worsening, new symptoms develop, or the minor-care protocol is not controlling the symptoms such that the problem is preventing performance of normal duties. A privileged provider can evaluate further and may prescribe additional medications to help decrease the symptoms during future menstrual cycles."],
  I3DP3 = [],
  I3DP4 = [],
  I3DPRE = [],
  I3DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: If due to sexual assault, immediately notify the supervising privileged provider. Do not leave the victim alone. Ask if she would prefer a female medic/privileged provider if one is available. If bleeding is over one week late or the previous bleeding was spotting, it could represent a pregnancy. Bleeding during pregnancy (positive hCG) can represent a miscarriage or complication of pregnancy and needs to be seen ASAP. Non-midline pelvic pain and pain with intercourse are signs of pelvic inflammatory disease. Bleeding after menopause (period of no cycle for 12 months after 45 y/o) needs to be evaluated for possible malignancy. Massive Bleeding needs to be seen immediately."],
  I3PRO = ["Menstrual Cramps: provide NSAID like naproxen or ibuprofen as needed for pain to be taken with food for up to 7 days. Toradol as a 1 x dose for moderate pain. A warm compress may also be placed over the abdomen to help with the discomfort.","RTC if symptoms are worsening, new symptoms developing, or symptoms are not controlled with the MCP."],
  I3LIMITATIONS = ["Aerobic exercise at own pace/ distance x 3 days","Must have access to restroom every hour"],
  I3GEN = ["pg. 106-107: This protocol is meant to cover menstrual difficulties and vaginal bleeding. If the problems are missed periods (possible pregnancy), vaginal discharge, or abdominal pain, screen according to the appropriate protocol."],
  I3MEDCOM = ["Obtain Laboratory Specimens pg.69-70(2)(k)"],
  I3STP1 = ["N/A"],

  I4ACT1 = [],
  I4ACT2 = [],
  I4ACT3 = [],
  I4DP1 = ["DP 2: Vaginitis may have an atypical presentation. In these situations, a more detailed evaluation is required."],
  I4DP2 = ["When facilities for a speculum exam and/or microscopic evaluation are not available and evacuation is unfeasible, the Soldier may be treated according the history below.","MCP for yeast infection. Presents with a scant amount of thick, white (cottage cheese like) discharge that is usually odorless and may be associated with vulvar itching, soreness, and dysuria. Symptoms are often worse the week before a menstrual cycle. Vaginal pH is typically normal (pH of 4-4.5). Treat with Fluconazole.","MCP for bacterial vaginosis. Presents with a thin, greyish discharge, vaginal pH greater than 4.5, and a fishy smell (prominent when 10% potassium chloride is added to a slide of vaginal discharge) without signs of inflammation. Symptoms are often pronounced during menstrual cycle or after intercourse. Treat with Metronidazole for seven days. Instruct the Soldier to return if the symptoms are worsening, new symptoms develop, or the minor-care protocol does not resolve the symptoms."],
  I4DP3 = [],
  I4DP4 = [],
  I4DPRE = [],
  I4DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Fever, non-midline pelvic pain, and pain with intercourse are symptoms of pelvic inflammatory disease, which is a serious infection requiring further evaluation. Vaginal infections and certain medications have a higher risk during pregnancy. Recurrent infections or infections that failed initial therapy require treatment regimens and closer observation. Vaginal discharge, lesion, or ulcer requires an invasive physical exam with laboratory evaluation. If facilities for a speculum physical exam and/or microscopic evaluation are not available and evacuation is not feasible, then treat according to history in minor-care protocol section."],
  I4PRO = ["Yeast Infection: treat with fluconazole.","Bacterial Vaginosis: treat with metronidazole for 7 days.","RTC if symptoms are worsening, new symptoms developing, or MCP does not resolve the symptoms."],
  I4LIMITATIONS = [],
  I4GEN = ["pg. 108-109: This protocol is meant to cover the majority of vaginal complaints not related to bleeding or a menstrual cycle. If a Soldier has external or vaginal discomfort along with symptoms suggesting a urinary tract infection (frequency, urgency, and internal dysuria), she should be screened as painful urination (dysuria)/frequent urination, E-1."],
  I4MEDCOM = ["Obtain Laboratory Specimens pg.69-70(2)(k)"],
  I4STP1 = ["N/A"],

  I5ACT1 = ["Check hCG"],
  I5ACT2 = [],
  I5ACT3 = [],
  I5DP1 = ["DP 2: Confirm the current USPSTF standards. Initial pap smear should be performed starting at 21 years old. From ages 21-29 years old, pap smear should be performed every three years. From age 30 and older, pap smear can be performed every three years or pap smear and HPV testing every five years if both tests are negative. HPV vaccine is recommended up to age 26. G/C screening is recommended yearly for women less than 26 y/o"],
  I5DP2 = ["No indication to rescreen. Patient can schedule an appointment for routine screening if desired; rescreen other symptoms if present"],
  I5DP3 = [],
  I5DP4 = [],
  I5DPRE = [],
  I5DPRED = ["DP 1: If the Soldier’s menstrual cycle is late, check a pregnancy test. If the Soldier is pregnant, refer to the AEM. Look in lab results for previous pap smears. If there has been an abnormal pap lab result, look for the clinical note that details the plan of care. Determine if the plan was followed and discuss with the AEM to determine care."],
  I5PRO = [],
  I5LIMITATIONS = [],
  I5GEN = ["pg. 110: A Pap test is a microscopic examination of cells to detect the presence of pre-cancerous or cancerous process."],
  I5MEDCOM = ["Obtain Laboratory Specimens pg.69-70(2)(k)"],
  I5STP1 = ["N/A"],

  I6ACT1 = ["Screening check hCG"],
  I6ACT2 = [],
  I6ACT3 = [],
  I6DP1 = ["DP 2: Long acting contraceptives are the most effective (surgical/permanent, IUD, implantable). Injectable, oral, patch, vaginal ring effectiveness is partially based on consistent, correct use. Condoms and behavioral modification are least effective. Choose the most effective method that the Soldier will be able to use successfully. If male, discuss the permanent nature of the procedure, discuss with AEM, and follow local protocol for referral. Estrogen-progesterone decrease menstrual symptoms, acne, and hirsutism. Progesterone and IUDs decrease menstrual symptoms. Longer term contraception to include injectable types have a risk of irregular bleeding, spotting. Discuss Soldier preferences and history with AEM. Check hCG if requesting Depo-Provera. Schedule accordingly: routine appointment (injectable, oral, patch, ring) or procedural appointment or referral based on supervising privileged provider preferences (implantable, IUD)."],
  I6DP2 = ["DP 2: Long acting contraceptives are the most effective (surgical/permanent, IUD, implantable). Injectable, oral, patch, vaginal ring effectiveness is partially based on consistent, correct use. Condoms and behavioral modification are least effective. Choose the most effective method that the Soldier will be able to use successfully. If male, discuss the permanent nature of the procedure, discuss with AEM, and follow local protocol for referral. Estrogen-progesterone decrease menstrual symptoms, acne, and hirsutism. Progesterone and IUDs decrease menstrual symptoms. Longer term contraception to include injectable types have a risk of irregular bleeding, spotting. Discuss Soldier preferences and history with AEM. Check hCG if requesting Depo-Provera. Schedule accordingly: routine appointment (injectable, oral, patch, ring) or procedural appointment or referral based on supervising privileged provider preferences (implantable, IUD)."],
  I6DP3 = [],
  I6DP4 = [],
  I6DPRE = [],
  I6DPRED = ["DP 1: Determine date of last menstrual cycle. Check a pregnancy test if the Soldier’s menstrual cycle is late. Determine history of previous contraceptive use. If the Soldier is having side-effects from her current birth control or has had recent unprotected sex, refer for further evaluation."],
  I6PRO = [],
  I6LIMITATIONS = [],
  I6GEN = ["pg. 111: Contraception provides prevention of unintended pregnancy. There are many different types of contraception depending on the Soldier’s goals."],
  I6MEDCOM = ["Obtain Laboratory Specimens pg.69-70(2)(k)"],
  I6STP1 = ["N/A"],

  J1ACT1 = [],
  J1ACT2 = [],
  J1ACT3 = [],
  J1DP1 = ["DP 2: Change in a lesion or oozing of fluids require further evaluation. Skin lesions that have been present for over 4 weeks may represent a symptom of a systemic condition."],
  J1DP2 = ["MCP for unidentified skin disorder. If the Soldier is already on a treatment for this issue, has not finished the current treatment, and the issue is not getting worse, then instruct the Soldier to continue with the current treatment for the full course. Some skin issues can take two to three weeks or potentially longer for them to work. Confirm with your supervising NCO or supervising privileged provider before returning the Soldier to work. If you recognize the skin lesion, then screen according to the identified skin condition. If you do not recognize the skin lesion, refer the Soldier to the AEM for further evaluation."],
  J1DP3 = [],
  J1DP4 = [],
  J1DPRE = [],
  J1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Skin rash associated with a medication, fever, or is painful (but not due to a sunburn) has the potential to be very serious. Further evaluation is indicated when it has failed previous treatment or is worsening. Certain anatomical locations present with a higher risk of complications to include the face, genitals area, or inhibiting a joint function."],
  J1PRO = ["Continue the current skin treatment regimen if it has not been completed/followed for the necessary amount of time (usually 2-3 weeks)","Screen according to pertinent algorithm if you can identify the skin condition.","Refer to AEM for further evaluation if you cannot identify the skin condition."],
  J1LIMITATIONS = ["Keep area clean and dry"],
  J1GEN = ["pg. 112-113: If the cause of the condition is unknown to the Soldier, this first protocol provides the category/ level of care indicated by the Soldier’s symptoms."],
  J1MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)"],
  J1STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125","Subject Area 18: Medication Administration. Administer Topical Medications 081-833-3020"],

  J2ACT1 = [],
  J2ACT2 = [],
  J2ACT3 = [],
  J2DP1 = ["DP 2: Moderate to severe acne or acne on the back or interferes with wearing equipment requires evaluation for oral medications and temporary profile. Scarring and hyperpigmentation requires more aggressive therapy to avoid further permanent scarring. There can be psychological effects from acne. It is important to identify Soldiers that are very self-conscious and escalating the treatment regimen to quickly control the acne."],
  J2DP2 = ["MCP for acne. All Soldiers with acne should be instructed to wash the affected area with mild soap and water without scrubbing twice a day and pat dry. Avoid creams and lotions to the area.","Non-inflammatory acne with closed comedones (white heads) or open comedones (black heads) can be treated with a topical retinoid. Retinoids should not be prescribed during pregnancy or if have fish allergy. Instruct Soldier to apply a pea sized amount of medication to a dry face at night. Treat the whole area (don’t spot treat) due to its preventative effect on acne. Don’t combine use with harsh soaps or other acne treatments. If skin irritation occurs, decrease use to every other night.","Mild to moderate inflammatory acne with papules can be treated with the addition of topical benzoyl peroxide with an antibiotic in the morning. Benzoyl peroxide should not be applied at the same time as a retinoid due to decreasing the retinoid’s effectiveness.","Instruct to return to clinic if not improving within two weeks, getting worse, or side-effects from the medications are occurring."],
  J2DP3 = [],
  J2DP4 = [],
  J2DPRE = [],
  J2DPRED = ["Red Flags. None.","DP 1: Birth control and a positive hCG requires additional counseling that should be provided by the supervising privileged provider. Hyperandrogenism requires additional evaluation. Draining lesions requires more aggressive therapy. Acute onset of acne symptoms for the first time after age 18 requires further evaluation."],
  J2PRO = ["For comedones, confirm a negative pregnancy test (if female) and no fish allergy. Provide topical retinoid for a pea size to be applied to the affected area of the dry face at night. Counsel to decrease to every other night if irrigations, dry skin occurs.","For mild to moderate inflammation, add topical combination of benzyl peroxide and antibiotics in the morning to the retinoid used at night.","RTC if symptoms are worsening, new symptoms developing, or symptoms are not controlled with the MCP within 2 weeks."],
  J2LIMITATIONS = [],
  J2GEN = ["pg. 114-115: Acne is caused by plugged oil glands. The oily material may form a ‘whitehead” or develop a dark colored “blackhead” when exposed to the air. Pimples develop when these plugged glands become inflamed and bacteria begin breaking down the oil-producing irritating substances as by-products. Acne is a common condition occurring primarily in the late teens and early twenties. Acne may be extremely upsetting to the young Soldier. The seriousness of this condition or its importance to the Soldier must not be underestimated. With proper treatment, acne can be improved thus avoiding scarring."],
  J2MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)","Obtain Laboratory Specimens(urine for HcG) pg.69-70(2)(k)"],
  J2STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125","Subject Area 18: Medication Administration. Administer Topical Medications 081-833-3020"],

  J3ACT1 = [],
  J3ACT2 = [],
  J3ACT3 = [],
  J3DP1 = ["DP 2: After failure of conservative therapy and lifestyle modifications, a permanent profile may need to be considered. Refer to the AEM for counseling prior to initiating the next step in therapy."],
  J3DP2 = ["Shaving routine modifications are the first line in treatment. The following adjustments can help reduce the penetration of the inter-follicular skin by the hair shaft. Instruct the Soldier to wash the face in a circular motion with soap and warm water once a day to free any embedded hairs. Use a warm compress or warm water on the face before shaving and apply generous amounts of shaving cream for 5 minutes before shaving to soften the hair. Use a single blade razor, shave in the direction of hair growth, and avoid stretching the skin during shaving to reduce the production of very short hairs. Medication can be used in conjunction with the shaving routine modifications. A topical retinoid at night with or without the combination of a low potency topical steroid. Bumps associated with pseudofolliculitis barbae can remain for a few months after treatment has been started. Instruct the Soldier to return if the symptoms are worsening, new symptoms develop, or the minor-care protocol does not appear to be helping after a few weeks."],
  J3DP3 = [],
  J3DP4 = [],
  J3DPRE = [],
  J3DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Facial cellulitis or a draining abscess are signs of a skin infection and not pseudofolliculitis barbae. These conditions require further evaluation and treatment. Cellulitis of the face can have life threatening complications."],
  J3PRO = ["Counsel the Soldier on shaving routine modification to include washing the face in a circula motion, warm compress and leaving shaving cream on for 5 min prior to shaving, and using a single blade razor. ","Topical retinoid with or without a low potency steroid can be used once a day at night as an adjunct. ","RTC if symptoms are worsening, new symptoms devebping, or symptoms are not controlled with the MCP."],
  J3LIMITATIONS = ["Shaving profile in eProfile"],
  J3GEN = ["pg. 115-117: Pseudofolliculitis barbae is a chronic condition of the beard area resulting from the reentry of the growing hair into the upper layer of the skin or facial hairs becoming trapped in the upper layer of the skin. The genetic predisposition of the African-American male to tight coiling hair makes him highly susceptible to this condition. The most common locations for lesions are the face and neck. The lesions can be painful and interfere with shaving although they rarely become secondarily infected. Permanent scarring is possible."],
  J3MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)"],
  J3STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125","Subject Area 18: Medication Administration. Administer Topical Medications 081-833-3020"],

  J4ACT1 = [],
  J4ACT2 = [],
  J4ACT3 = [],
  J4DP1 = ["DP 2. Dandruff, can be a chronic relapsing condition even in its mild form. All antifungal shampoos are not the same and Soldiers may have different responses to them. OTC treatment may take some trial and error to find the shampoo that is right for the Soldier. Inflammation, lesions with oozing and crusting are signs that the symptoms are getting worse and the Soldier needs to be evaluated inside of a clinic setting."],
  J4DP2 = ["MCP for dandruff. There are some risk factors that make a Soldier more susceptible. Some risk factors include if the Soldier is male, Soldier has excessively oily skin and hair and/or if the Soldier suffers from certain diseases (for example, Parkinson’s disease, HIV).","OTC medication: Antifungal shampoo used daily (2-3 times per week minimal) for several weeks and remission is achieved. Manage stress levels, spend time (a few minutes) outdoors in the sun (DO NOT sunbathe). OTC medication: Antifungal shampoo used daily (2-3 times per week minimal) for several weeks and remission is achieved. Instruct the Soldier to seek medical assistance if mild dandruff is still present and not improving after three to four weeks of antifungal shampoo use, symptoms worsen, or new symptoms begin."],
  J4DP3 = [],
  J4DP4 = [],
  J4DPRE = [],
  J4DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”","DP 1. Visible inflammation with patchy, orange to salmon-colored or grayish plaques covered with yellowish, greasy scales, concretions of scale around hair shafts, lesions consisting of fissures, oozing, and crusting, are all signs of a more severe form of scalp seborrheic dermatitis."],
  J4PRO = ["Antifungal shampoo used daily (2-3 times per week minimal) for several weeks and rem ission is achieved. ","Manage stress levels. ","Spend time (a few minutes) outdoors in the sun (DO NOT sunbathe).","Return to clinic if mild dandruff is still present after 3-4 weeks of antifungal shampoo use, symptoms worsen, or new symptoms begin."],
  J4LIMITATIONS = [],
  J4GEN = ["pg. 118-119: Dandruff which is also known as pityriasis sicca, is the mildest and most common form of scalp seborrheic dermatitis. White scales or flakes on the head or hair with mild itching are the most common symptoms."],
  J4MEDCOM = [],
  J4STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125","Subject Area 18: Medication Administration. Administer Topical Medications 081-833-3020"],

  J5ACT1 = [],
  J5ACT2 = [],
  J5ACT3 = [],
  J5DP1 = ["DP 2: Tinea capitis is a fungal infection of the scalp that presents with itching, scaling, and hair loss. It is common in kids but can occur in adults. Treatment is with an oral antifungal. Papules, pustules, and erythema are signs of inflammation which require further evaluation."],
  J5DP2 = ["MCP for traction hair loss: Hair loss associated with traction being applied to hair for an extended period of time from tight hair styles often over the frontal and temporal areas. It is associated with traction folliculitis which includes erythema, papules, and sterile pustules. Instruct Soldier to avoid tight hair styles, chemical straighteners, and heating the hair follicle (for example, curling iron, straight iron) until it has resolved. Refer to AEM if signs of inflammation are present to evaluate for treatment with a high potency topical steroid or intra-lesion steroid inject.","MCP for male/female pattern hair loss: Male pattern hair loss often occurs after age 30 with hair loss over the frontal, temporal, and top of the head. On examination, hair follicles with a decreased caliber will be seen. Female pattern hair loss occurs over the front and top of the head. It most often occurs after menopause. Instruct the Soldier on the diagnosis.","Refer to AEM if does not meet either of the above patterns. Return to clinic if symptoms worsen or new symptoms develop."],
  J5DP3 = [],
  J5DP4 = [],
  J5DPRE = [],
  J5DPRED = ["Red Flags. None.","DP 1: Examples of medications that can result in hair loss are propranolol, ketoconazole, isotretinoin, colchicine, and cholesterol medications. If hair follicules are not present on exam, then scarring hair loss is more likely requiring a referral to dermatology. Alopecia areata is described as smooth, circular discrete hair loss that occurs over a couple of weeks. Refer to a privileged provider for consideration of intra-lesion steroid injections."],
  J5PRO = ["Traction Hair Loss: counsel Soldier to avoid tight hair styles, chemical relaxants, and applying heat to hair until resolved. Refer to AEM for further evaluation if signs of inflammation are present. ","Male/female pattern hair loss (FPHL): discuss the suspected diagnosis with the AEM and then provide counseling to the patient. ","RTC if symptoms worsen or new symptoms begin."],
  J5LIMITATIONS = [],
  J5GEN = ["pg. 120-121: While most hair loss is natural and hereditary, any hair loss that is sudden or extreme in nature may have resulted from a fungal infection or other forms of illness or as a result of using certain medications. When treated promptly and properly, hair growth typically resumes."],
  J5MEDCOM = [],
  J5STP1 = [],

  J6ACT1 = [],
  J6ACT2 = [],
  J6ACT3 = [],
  J6DP1 = ["DP 2. Some fungal infections are unresponsive to topical medications and a systemic antifungal treatment is required. Ulcers increase the risk of a secondary bacterial infection."],
  J6DP2 = ["MCP for athlete’s foot. This type of fungal infection requires keratin for growth, which restricts the infection to the superficial skin, hair, and nails. Interdigital tinea pedis, hyperkeratotic (moccasin-type) tinea pedis and vesiculobullous (inflammatory) tinea pedis are the 3 major categories of tinea pedis infections.","OTC medication: topical antifungal therapy can used to cure a fungal infection which has no secondary infection. Antifungal cream is applied twice a day for one week. Instruct the Soldier to return to the clinic if the fungal infection does not respond to OTC medications, symptoms worsens, new symptoms develop. Prevention measures: Athlete's foot can be spread through direct and indirect contact. Direct, skin-to-skin contact, occurs when an uninfected person touches the infected area of somebody with athlete's foot while indirect contact, is when the fungi can infect people via contaminated surfaces, clothing, socks, shoes, bed sheets, and towels. Instruct Soldier to keep his or her feet clean and dry, change socks regularly, wear well ventilated shoes and provide feet protection in public places. Use antifungal powder daily, alternate shoes and do not share shoes."],
  J6DP3 = [],
  J6DP4 = [],
  J6DPRE = [],
  J6DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”","DP 1. Peeling, cracking, redness, blisters, and breakdown of the skin with itching and burning are characteristics of both dry skin and athlete’s foot. If untreated, the fungal infection can lead to a severe secondary bacterial infection."],
  J6PRO = ["Antifungal lotion, ointment, powder or spray-applied twice a day for 4-8 weeks. ","RTC if the fungal infection does not respond to medications, symptoms worsens, new symptoms develop. Prevention ","Instruct patient to keep their feet thy, change socks regularly, wear well ventilated shoes and provide feet protection in public places. Use antifungal powder daily, alternate shoes and do not share shoes."],
  J6LIMITATIONS = [],
  J6GEN = ["pg. 122-123: Tinea pedis (athlete's foot) most commonly occurs with frequently wearing damp socks and/or tight fitting shoes. It is contagious and can be spread by contact with an infected person or contaminated surface."],
  J6MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)"],
  J6STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125","Subject Area 18: Medication Administration. Administer Topical Medications 081-833-3020"],

  J7ACT1 = ["Perform potassium hydroxide (KOH) examination"],
  J7ACT2 = ["Perform potassium hydroxide (KOH) examination"],
  J7ACT3 = [],
  J7DP1 = ["DP 2. Some infections and rashes do not respond well to OTC medications and infections may not get better or may reoccur within a few weeks. These Soldiers need to be evaluated to rule out more serious skin conditions. A normal infection may respond better to a prescription strength antifungal.","Note: In the absence of any of the preceding conditions, minor-care is appropriate."],
  J7DP2 = ["MCP for jock itch. Tinea cruris is far more common in men than women. Predisposing factors include copious sweating, obesity, diabetes, and immunodeficiency.","OTC medication. Topical antifungal medication twice a day for two weeks. Instruct Soldier to keep groin area clean and dry and return to clinic if symptoms worsens, new symptoms develop, symptoms not improving within two weeks, or if the infection returns within a few weeks after using OTC Medications."],
  J7DP3 = [],
  J7DP4 = [],
  J7DPRE = [],
  J7DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”","DP 1. Diabetes can affect every part of the body, including the skin. Soldiers with diabetes are more susceptible to skin conditions such as bacterial infections and fungal infections. Although common infections can be self-treated, the Soldier should see a privileged provider to rule out other more serious diabetic related skin conditions."],
  J7PRO = ["Topical antifungal medications twice a day for 2 weeks ","Instruct patient to keep groin area clean and dry and RTC if symptoms worsens, new symptoms develop, symptoms not improving within 2 weeks, or if the infection returns within a few weeks after using medications. ","Preventive- Hygiene"],
  J7LIMITATIONS = [],
  J7GEN = ["pg. 124-125: Tinea cruris (also known as jock itch) is a dermatophyte infection involving the crural (superior medial portion of the thigh) fold. The spreading of tinea pedis is often the cause for these infections. Infection may spread to the perineum and perianal areas, into the gluteal cleft, or onto the buttocks."],
  J7MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)"],
  J7STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125","Subject Area 18: Medication Administration. Administer Topical Medications 081-833-3020"],

  J8ACT1 = ["Perform potassium hydroxide (KOH) examination"],
  J8ACT2 = [],
  J8ACT3 = [],
  J8DP1 = ["DP 2: Tinea versicolor often reoccurs. When this occurs, additional counseling to the Soldier is required to help prevent further occurrences. Refer to the AEM for additional counseling and preventative measures. If it is an atypical presentation that you do not recognize, refer to the AEM for further evaluation and treatment."],
  J8DP2 = ["MCP for tinea versicolor. Treat with topical terbinafine twice a day for one week. Selenium sulfide 2.5% shampoo lathered over the affected area and left for 10 minutes once a week is also effective. Instruct the Soldier that hypo/hyperpigmentation of the area may remain for months after effective treatment. If the presentation is not classic for tinea versicolor, screen according to the appropriate protocol and discuss with the AEM. Return to the clinic for worsening symptoms, new symptoms, or presence of scale in the lesions after treatment."],
  J8DP3 = [],
  J8DP4 = [],
  J8DPRE = [],
  J8DPRED = ["Red Flags. None.","DP 1: Tinea versicolor that has failed initial therapy or is widespread may require systemic treatment. Presence of scale in the area and a positive potassium hydroxide (KOH) test confirms treatment failure requiring systemic treatment. Refer to the supervising privileged provider for counseling and evaluation for treatment."],
  J8PRO = ["Topical antifungal medications twice a day for 1 week. ","Instruct patient that the hypo/hyper pigmented areas can remain for months after effective treatment. ","If the presentation is atypical, screen according to the identified lesion. If not able to identify the lesion, refer to the AEM for further evaluation and treatment. ","RTC for worsening symptoms, new symptoms, or presence of scale in the lesions after treatment"],
  J8LIMITATIONS = [],
  J8GEN = ["pg. 126-127: Tinea versicolor is a common superficial fungal infection that appears as “spots” (lighter, darker, or redder than surrounding skin) on the neck, chest, back, and arms usually with no other symptoms. The rash is typically scaly and painless. It may be noticed in the summer when affected areas fail to tan after sun exposure."],
  J8MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)"],
  J8STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125","Subject Area 18: Medication Administration. Administer Topical Medications 081-833-3020"],

  J9ACT1 = ["Prepare informed consent, timeout, I&D set-up if provider requests"],
  J9ACT2 = ["Prepare informed consent, timeout, I&D set-up if provider requests"],
  J9ACT3 = [],
  J9DP1 = ["DP 2: An abscess should be drained to allow it to heal, and an abscess with a diameter of greater than 5 cm will need to be packed. Military population is at risk for community transmission of staphylococcus aureus and should be evaluated for the addition of antibiotic therapy."],
  J9DP2 = ["MCP for skin infection. Prior to abscess formation, the skin normally becomes indurated from the inflammation. The skin appears to be warm, red, and tender with a hard area where the inflammation is present. Treatment is minor-care. An abscess may form within a couple of days requiring further treatment.","Apply a moist, warm compress over the area for 20 minutes every four hours. It will increase blood flow to the area, allowing the Soldier’s immune system to fight the infection. Instruct the Soldier to return to the clinic after the abscess forms for drainage. Return sooner, if symptoms worsen (for example, fevers, chills, increased pain or redness, red streaks, increased swelling, or re-accumulation of pus, if it has already drained)."],
  J9DP3 = [],
  J9DP4 = [],
  J9DPRE = [],
  J9DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Pilonidal abscesses (over the tail bone) can be much larger than they appear and should be referred to a privileged provider for evaluation. Systemic inflammatory response syndrome (SIRS) criteria, fever, black eschar, rapid progression over hours, and worsening on oral antibiotics are signs of a more significant infection that may require hospitalization. Hand infection, infection over a joint, indwelling medical device, and associated cellulitis increases the risks of serious complications."],
  J9PRO = ["Apply a warm moist compress over the abscess for 20 minutes every four hours. ","RTC for worsening symptoms (fever/chills, re-accumulation of pus, increased pain/ redness, red streaks, or increased swell ing), new symptoms, if not improving within 3 days."],
  J9LIMITATIONS = [],
  J9GEN = ["pg. 128-129: A boil is usually caused by bacteria that enters through a hair follicle. A painful nodule enclosing a core of pus forms in the skin. Tenderness, warmth, swelling, and firm area, and pain may be present around the area of inflammation. An extremely large boil or numerous boils can produce fever. Boils are also known as furuncles if they have single cores or carbuncles if they have multiple cores."],
  J9MEDCOM = [],
  J9STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125","Subject Area 18: Medication Administration. Administer Topical Medications 081-833-3020"],

  J10ACT1 = [],
  J10ACT2 = [],
  J10ACT3 = [],
  J10DP1 = ["DP 2: Elevated temperature, sore throat, sores on the hand, and moderate to severe pain increase the chance of an alternative viral infection or initial infection requiring further evaluation and possible systemic antiviral therapy. Pustules and yellow, honeycomb crusting suggest a bacterial infection requiring further evaluation."],
  J10DP2 = ["MCP for fever blister. Instruct Soldier on contagious nature of HSV-1, cold sores. Soldier is contagious a little all of the time. When symptomatic or cold sores are present, the Soldier is very contagious, and the virus is spread through direct contact. Instruct the Soldier to avoid sharing drinks or kissing anyone till after it has resolved. Provide docosanol (Abreva) topical ointment to be applied to the cold sore five times a day or two doses of valacyclovir (2g), 12 hours apart. Return to clinic if symptoms are worsening, new symptoms develop, or it is not improved within 10 days."],
  J10DP3 = [],
  J10DP4 = [],
  J10DPRE = [],
  J10DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: HSV-1 infection can occur at any mucosal or skin site. Although rare, eye infection with HSV causes keratitis. Eczema and burns result in breaks in the skin’s natural protective barrier increasing the risk of spreading the HSV infection to these areas."],
  J10PRO = ["Counsel the Soldier on the contagious nature of the virus and to avoid sharing a drink or kissing anyone till it has resolved.","Provide docosanol topical ointment (1st line) to be applied 5 x per day till cold sore is healed or valacyclovir (2nd line).","RTC if symptoms worsen, new symptoms develop. or it is not improved within 10 days."],
  J10LIMITATIONS = [],
  J10GEN = ["pg. 130-131: Fever blisters result from an acute viral infection that frequently occurs around the mouth or on the lips. Fever blisters usually occur with multiple vesicular lesions on an erythematous base. Lesions can be painful and last for 10-14 days. Initial infection can be associated with systemic symptoms, like fever and malaise. Viral infection resides in the nerve cells after the initial infection and can reoccur when the body is under stress. Re-emergence of the cold sores is often preceded by prodromal symptoms of pain, burning, tingling, or itching for 6 hours to 2.5 days. Cold sores are contagious and spread through contact."],
  J10MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)"],
  J10STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125","Subject Area 18: Medication Administration. Administer Topical Medications 081-833-3020"],

  J11ACT1 = [],
  J11ACT2 = [],
  J11ACT3 = [],
  J11DP1 = ["DP 2: Erythema, warmth, and increased tenderness are signs of inflammation or an early infection that requires further evaluation. A laceration needs to be evaluated to determine if it needs to be closed."],
  J11DP2 = ["Gently wash the affected area with soap and water. If there is a laceration, irrigate inside the laceration using a syringe with jets of sterile saline. While washing and irrigating the wound, ensure that all foreign material has been removed from the wound.","MCP for abrasion: Cover the abrasion with an antibacterial ointment (Bacitracin). Provide the ointment for the Soldier to apply to the abrasion twice a day. Cover the abrasion with a protective, non-stick sterile dressing and have the Soldier change the dressing daily or when saturated with fluid. Keep the area clean and dry.","MCP for laceration: If the edges of the wound can be brought together easily, bleeding is controlled, and there are no signs of infection, minor-care is appropriate. Steri-strips may be applied to keep the skin edges together. If it is a laceration, return to clinic in 24-48 hours for re-evaluation. Otherwise, return to clinic for increasing redness, bad smell, thick discharge, increasing tenderness, or other concerns to include the edges becoming separated."],
  J11DP3 = [],
  J11DP4 = [],
  J11DPRE = [],
  J11DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: SIRS criteria includes two of the following: heart rate over 90 bpm, respiratory rate over 20, Temp >100.4o F or <96.8o F, or WBC >12,000 cells. SIRS criteria with a source of infection is sepsis and requires prompt treatment. Fever, red streaks, and oozing wounds indicate an infection that requires further evaluation and treatment. Puncture wounds, avulsions, from crushing or burns, and wounds contaminated with dirt, saliva, or feces require tetanus if not given within last 5 years. Clean wounds require tetanus if not given within last 10 years. High risk wounds increase the risk of complications. Bite wounds have a risk of infection. Lacerations over a joint, on the face, or on the hand or foot have a higher risk of complication from the laceration."],
  J11PRO = ["Wash the area with soap and water. Ensure the area is thoroughly irrigated and all foreign material has been removed. Cover the area with an antibiotic ointment and sterile dressing. ","Provide materials for wound care. Counsel the Soldier on how to take care of the wound. ","RTC for increasing redness, bad smell, thick discharge, increasing tenderness, or other concerns. "],
  J11LIMITATIONS = ["Keep area clean and dry"],
  J11GEN = ["pg 132-133: Skin abrasions are caused when the skin is rubbed raw such as when a knee or elbow is scraped. While this type of injury is painful, it normally requires only minor treatment."],
  J11MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)","Perform Wound Care pg.70(l)"],
  J11STP1 = ["Subject Area 2: Medical Treatment. Initiate Treatment for a Soft Tissue Injury 081-833-0063"],

  J12ACT1 = [],
  J12ACT2 = [],
  J12ACT3 = [],
  J12DP1 = ["DP 2: Incomplete closure should be referred to the AEM to determine the next step in wound care."],
  J12DP2 = ["Suture should be removed when:","The wound has healed (within 5 to 10 days).","The suture line is clean.","No purulent drainage, redness, or swelling is present.","Document the appearance of the wound (sutured laceration) and number and type of sutures removed. Provide bacitracin if wound edges are still healing. Counsel the patient on wearing sunscreen and sensitivity of the scar to the sun with resulting hyperpigmentation for the first year."],
  J12DP3 = [],
  J12DP4 = [],
  J12DPRE = [],
  J12DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Fever, pus, or redness and swelling at the suture location can be a sign of a secondary infection. Refer the patient to the supervising privileged provider for further evaluation and treatment."],
  J12PRO = ["Bacitracin for the scar","Protect the scar from the sun","Wear sunscreen for three months to protect from discoloration","(Source: up-to-date)"],
  J12LIMITATIONS = [],
  J12GEN = ["pg. 134-135: Sutures should be removed after the skin edges have started to heal together. If sutures are left in too long, it can result in increased scar formation. If sutures are removed too early, the wound can reopen or pull apart at the edges resulting in a larger scar."],
  J12MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)","Assists Privileged Provider To Perform Invasive Procedures pg.68(5)","Sets Up and Maintains A Sterile Field pg.68(7)","Perform Suturing pg.68(11)","Perform Wound Care pg.70(l)"],
  J12STP1 = ["Subject Area 20: Medical Treatment. Perform Suture Removal 081-833-0026"],

  J13ACT1 = ["Provide emergency stabilization (oxygen, IVG, airway management, epinephrine auto injector) prior to transport if necessary"],
  J13ACT2 = [],
  J13ACT3 = [],
  J13DP1 = ["DP 2: If the Soldier has not started a medication within the last two weeks, then the rash may not be from a medication. Further evaluation by the AEM is required. Itchy rash (likely hives) with other symptoms needs to be seen by the AEM for evaluation of a more serious reaction."],
  J13DP2 = ["MCP for hives (urticarial). Caused by the release of histamine from mast cells often related to an allergic reaction and present with circumscribed, raised, red rash with central pallor that moves around. Treatment is avoidance of the irritating substance, if it can be identified. Benadryl at bedtime can help with the symptoms and allow the Soldier to sleep. Provide up to a three day course of the medication.","MCP for irritant contact dermatitis. Presents with burning, redness, and may progress to fissures of the skin. Treatment is with avoidance of the irritating substance. Skin lotion to help the skin retain moisture and heal. Hydrocortisone ointment PRN inflammation.","MCP for allergic contact dermatitis. Presents with red, itchy well demarcated area with vesicles, bumps, or scaly skin. Treatment is with avoidance of the irritating substance. Hydrocortisone cream or Burrow’s solution compresses can help with the irritation and itching."],
  J13DP3 = [],
  J13DP4 = [],
  J13DPRE = [],
  J13DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: An allergic reaction can include swelling within the airway, wheezing and breathing problems, to anaphylaxis. Immediate stabilization and treatment is required. Blistering over the body and oral involvement are signs of a more serious drug reaction. Petechial rash and fever are signs of vasculitis (palpable purpura)."],
  J13PRO = ["Hives are common. Counsel to avoid offending agent. Discuss with AEM and notify prescribing provider. Provide benadryl twee limes a day for 3 days. ","Irritant contact dermatitis should be treated with avoidance and skin moisturizing lotion or cetaphil body wash with the addition of hydrocortisone ointment three times a day if needed for 1-2 weeks. ","Allergic contact dermatitis should be treated with avoidance, hydrocortisone ointment three a day as needed for 1-2 weeks, and Burrow's solution compresses every 4 hours for 30 minutes as needed.","RTC for worsening symptoms, development of new symptoms, or other concerns."],
  J13LIMITATIONS = ["Avoidance of offending agent","Use latex free gloves or moisturizing soap"],
  J13GEN = ["pg. 136-137: Drugs can cause an acute rash of small red spots over the entire body in individuals who are sensitivity to them, like antibiotics or sulfonamides. Contact dermatitis results when the skin comes in contact with anything in the environment that causes an inflammatory reaction, like shoe materials, watchbands, earrings, and poison ivy. Contact area can present with burning, itching, redness, and fissures or vesicles. Poison ivy is the most common example of this group and related to an oil in the plant’s leaves. Symptoms usually develop within 24 to 48 hours of contact."],
  J13MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)"],
  J13STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125","Subject Area 18: Medication Administration. Administer Topical Medications 081-833-3020"],

  J14ACT1 = ["Provide emergency resuscitation before transport"],
  J14ACT2 = [],
  J14ACT3 = [],
  J14DP1 = ["DP 2: Limited partial thickness (second degree) burns present with red, painful skin that may weep and blisters within 24 hours. These burns typically heal within 3 weeks but require additional management due to risk of secondary infection. Secondary infection (for example, warmth, thick discharge, smell, increasing redness) is a potential complication that should be referred to the AEM. Sunburn of greater than 25% of the Soldier’s body surface area or symptoms of exhaustion should be evaluated for a heat injury."],
  J14DP2 = ["MCP for burns. Superficial burns only include the epidermal layer of skin. They are red and painful but do not blister. The pain and redness typically resolves within three days, and they heal without scarring. Apply cold packs to the affected area as needed for comfort. Leave the area uncovered. Provide acetaminophen or ibuprofen as needed for pain. For sunburn, instruct the Soldier on the importance of using sunscreen, reapplying it every hour, and risks of cancer with repetitive sun damage to the skin. May recommend OTC aloe vera for additional pain relief. Return to clinic for worsening symptoms, new symptoms, or if not improving within three days."],
  J14DP3 = [],
  J14DP4 = [],
  J14DPRE = [],
  J14DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: A Soldier with any potential for airway involvement or smoke inhalation causing symptoms should be immediately transported to the nearest qualified or privileged provider. High risk locations for burns include the head, neck, hand, feet, female breast, genitalia, perineum, major joints, and circumferential burns and should be evaluated for referral to a burn center. Partial thickness burns >10% of body surface area, chemical burns, full thickness burns, electrical burns, and burns with associated trauma have a higher risk and should also be evaluated for a burn center. Deep partial thickness (second degree) are painful to pressure only, appear waxy or wet, and do not blanch with pressure. They typically heal within two months."],
  J14PRO = ["Apply cool compresses. Provide ibuprofen or acetaminophen as needed for pain. Keep the area clean and uncovered. May recommend aloe vera for additional pain relief","RTC for worsening symptoms, new symptoms, if not improving within 3 days."],
  J14LIMITATIONS = ["Keep area clean","Avoid additional heat exposure to area"],
  J14GEN = ["pg. 138-139: A burn is defined as any injury to the outer layer of skin or deeper tissue caused by heat, chemicals, or electricity. Minor burns are characterized by redness, pain, and tenderness. More severe burns may not have these symptoms. Sunburn is generalized redness of the skin produced by overexposure to sunlight. Sunburns should be avoided due to repeat occurrences increasing the risk of permanent injury to the skin and increased risk of skin cancer."],
  J14MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)","Initial Treatment of Environmental Injuries pg.69(2)(e)"],
  J14STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125","Subject Area 18: Medication Administration. Administer Topical Medications 081-833-3020"],

  J15ACT1 = [],
  J15ACT2 = [],
  J15ACT3 = [],
  J15DP1 = ["DP 2. Large open and infected blisters can become serious health hazards and should be referred to the AEM for further evaluation and treatment."],
  J15DP2 = ["MCP for blister on the foot. Wash area with antibacterial soap. Cover a large area of surrounding undamaged skin and the treated blister with a protective dressing of moleskin with a hole in the middle cut out for the blister. An adhesive solution such as tincture of benzoin or a surgical adhesive to the skin around the blister to improve the adhesion of the moleskin. Have the Soldier return to the clinic after the blister ruptures.","MCP for ruptured blisters on the feet. Clean the skin with Betadine. Remove the dead skin with sterile scissors. If sterile instruments are not available or personnel have not been taught to perform the procedure, skip this step. Wash area with Betadine and apply an antibacterial ointment to the blister only. Cover a large area of surrounding undamaged skin and the treated blister with a protective dressing of moleskin between treatments. An adhesive solution such as tincture of benzoin may be applied to the skin around the blister to improve the adhesion of the moleskin. Reevaluate the Soldier every 24 hours.","Instruct the Soldier to wear two pairs of socks when wearing combat boots (for example, a thin pair of nonabsorbent, non-cotton socks under the boot socks) and to check for proper fit of boots.","Instruct the Soldier to return for further evaluation if: the protective dressing begins to come off, develops blisters that make wearing shoes or boots difficult, significant pain, or signs of infection develop."],
  J15DP3 = [],
  J15DP4 = [],
  J15DPRE = [],
  J15DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1. Serious skin conditions can present with blisters. Fever, malaise, and epidermal sloughing are signs of a more serious medical condition."],
  J15PRO = ["Wash area with betadine and apply an antibacterial ointment to the blister only. ","Cover a large area of surrounding undamaged skin and the treated blister with a protective dressing of moleskin between treatments. An adhesive solution such as tincture of benzoin or a surgical adhesive may be applied to the skin around the blister to improve the adhesion of the moleskin. ","Wear two pairs of socks when wearing combat boots (a thin pair of nonabsorbent, non-cotton socks under the boot socks) and to check for proper fit of boots.","Instruct the patient to return for further evaluation if:","The protective dressing begins to come off.","He develops blisters that make wearing shoes or boots impossible.","He is disabled by pain.","He has signs of infection. ","The patient should be reevaluated every 24 hours"],
  J15LIMITATIONS = ["No running, rucking, or jumping","Walk at own pace/ distance"],
  J15GEN = ["pg. 140-141: Friction blisters are common and should be treated to prevent complications."],
  J15MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)","Assists Privileged Provider To Perform Invasive Procedures pg.68(5)","Sets Up and Maintains A sterile Field pg.68(7)","Perform Wound Care pg.70(2)(i)"],
  J15STP1 = ["Subject Area 18: Medication Administration. Administer Topical Medications 081-833-3020"],

  J16ACT1 = [],
  J16ACT2 = [],
  J16ACT3 = [],
  J16DP1 = ["DP 2: Plantar warts requires additional treatment. Warts disrupt the normal skin markings so skin lines are not evident and have several dark specks within middle of the wart. One treatment option is using liquid nitrogen to freeze the wart in the clinic. An order from a privileged provider is required prior to treating with liquid nitrogen. Bunions are located on the medial side of the base of the first metacarpal with the big toe deviated inward. Bunions may need to be referred to podiatry."],
  J16DP2 = [],
  J16DP3 = [],
  J16DP4 = [],
  J16DPRE = [],
  J16DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: No red flags. Diabetes mellitus or a decreased peripheral sensation increases the risk to the Soldier with a peripheral wound; so evaluation and treatment of a corn should be referred to a privileged provider."],
  J16PRO = ["MCP for corns on feet. Soak the Soldier’s foot in warm water for 20 minutes. Paring down a callous/corn: The performing medic must have training in the procedure and have the training documented. After the risks and benefits of the procedure have been explained to the Soldier, Soldier has signed the consent form, and a final timeout has been performed, pare down the callous or corn with a scalpel blade. Reduce the hard skin until the lesion is flexible or the Soldier can stand/bear weight without discomfort. Do not remove skin to the point of bleeding.","Instruct the Soldier on weekly self-debridement. Minor-care can be given using a pumice stone. Refer to AEM if special insole is needed to be constructed for the Soldier’s shoe. Instruct the Soldier to return if the symptoms are worsening, new symptoms develop, or the minor-care protocol does not resolve the symptoms.","RTC if symptoms are worsening, new symptoms developing, or symptoms are not controlled with the MCP"],
  J16LIMITATIONS = ["No running, rucking, or jumping","Walk at own pace/ distance"],
  J16GEN = ["pg. 142-143: A callus is a thickened outermost layer of skin from repeated friction or pressure. A corn has a centralized hyperkeratotic area that is often painful on the sole of the foot or toe. Tenderness occurs especially during weight-bearing on the foot"],
  J16MEDCOM = ["All Medication Protocols Associated with 68W Training and Certifications pg.68(k)","Assists Privileged Provider To Perform Invasive Procedures pg.68(5)","Sets Up and Maintains A sterile Field pg.68(7)","Perform Wound Care pg.70(l)"],
  J16STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125"],

  J17ACT1 = [],
  J17ACT2 = [],
  J17ACT3 = [],
  J17DP1 = ["DP 2: More than three warts will likely require a follow-up visit. AEM should see the Soldier if he or she returns for complications of the wart treatment or a repeat treatment."],
  J17DP2 = ["MCP for cutaneous wart. Discuss the Soldier and your treatment plan with the AEM and obtain the supervising privileged provider approval prior to starting treatment. Medic must be trained and have had his or her procedure competency validated prior to performing a procedure. All procedures will be directly supervised.","Discuss the treatment options and their risks, benefits, and alternative that warts will often go away without treatment after several years with the Soldier. After the consent has been obtained and procedure approved by the supervising privileged provider, perform a final timeout. Clean the wart and surrounding skin. Pare down the callous over the wart but not to the point of bleeding or pain. Then apply the treatment option that the Soldier chose. Treatment options include salicylic acid, cryotherapy, or a combination of both. Cryotherapy includes 2 freeze thaw cycles that cover the wart and 2mm around the wart that takes 30-60 seconds to thaw. Instruct the Soldier that a blister, loss of skin pigmentation to the area, and pain may develop over the site. Salicylic acid may be applied to the wart after freezing and covered with a bandage or without freezing and covered with tape. Soldier can reapply salicylic acid and replace the tape or bandage every two days. Soldier should return in two weeks for re-evaluation and retreatment if needed. It is common for warts to require ongoing treatment for up to 12 weeks. Return earlier if new symptoms or complications from the treatment develop."],
  J17DP3 = [],
  J17DP4 = [],
  J17DPRE = [],
  J17DPRED = ["Red Flags. None.","DP 1: Bleeding may indicate that the lesion is something other than a wart and requires further evaluation. Higher risk locations include the face, breast, perineum, anus, and genital regions. Greater than 10 lesions will require multiple repeat visits and other treatment options can be considered. If treatment would limit or prevent the Soldier from conducting an upcoming mission/task, refer to the supervising privileged provider to determine the best timing of treatment. If signs of an infection or inflammation are present around the wart, refer to the supervising privileged provider for treatment."],
  J17PRO = ["Obtain approval for treatment from AEM. Counsel the Soldier on options, risks, and course of treatment. ","Consent and Final Timeout. Clean area and pare down built-up skin. Cryotherapy - 2 freeze thaw cycles, freezes the wart and 2mm around it with 30-60 seconds to thaw and/or salicylic acid. Salicylic acid is reapplied daily if using a bandage or every 2 days if using tape.","RTC if new symptoms develop or in 2 weeks for next treatment."],
  J17LIMITATIONS = ["On Foot:","No running, rucking, or jumping","Walk at own pace/ distance"],
  J17GEN = ["pg. 144-145: A cutaneous wart is a benign growth of skin caused by a virus. Common and plantar warts often have thrombosed capillaries within them that look like black dots or ‘seeds’"],
  J17MEDCOM = ["All Medication Protocols Associated with 68W Training and Certifications pg.67(k)","Assists Privileged Provider To Perform Invasive Procedures pg.68(5)","Sets Up and Maintains A Sterile Field pg.68(7)","Removes Skin Warts On Extremities As Ordered pg.68(14)","Perform Wound Care pg.70(l)"],
  J17STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125"],

  J18ACT1 = [],
  J18ACT2 = [],
  J18ACT3 = [],
  J18DP1 = ["DP 2: Moderate lesions are characterized with substantial erythema and pus. Toenail removal (partial or complete) requires an order for the procedure by a privileged provider. Task must be trained, validated, and documented with the competency assessment file for a medic to be able to perform it. After toenail removal (partial or complete), have the Soldier return in three days to evaluate for healing and for spicule reformation with nail regrowth."],
  J18DP2 = ["MCP for ingrown toenail. Mild lesions can be treated with conservative measures. Signs include minimal to moderate discomfort, some redness, and no discharge or pus. Educate the Soldier on not cutting the toenail below the lateral fold, allowing the toenail to grow out past the lateral fold before trimming, and importance of well-fitting shoes. Poorly fitting shoes can predispose the Soldier to ingrown toenails. Soak the affected foot in warm, soapy water for 15 minutes three times per day. While the foot is soaking, push the nail fold away from the nail. After soaking and drying the area, place a piece of cotton or dental floss under the lateral edge of the nail to separate it from the nail fold. Hydrocortisone cream 1% can also be applied to the inflamed area after each soaking to further decrease inflammation. Consider duty limitation for up to 3 days as needed.","Return to clinic in one week if still having symptoms or sooner if symptoms are worsening to include spreading or increasing redness, formation of pus or discharge, or increasing discomfort"],
  J18DP3 = [],
  J18DP4 = [],
  J18DPRE = [],
  J18DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Severe lesions are characterized with signs of spreading infection to include red streaks, cellulitis, or ingrown toenails along both nail folds. Red flags, cellulitis, diabetes, and immunocompromised may indicate or increase the risk of a more severe infection requiring antibiotics. Recurrent ingrown toenails need to be evaluated by the supervising privileged provider to determine if permanent nail ablation is required."],
  J18PRO = ["Educate the Soldier on proper trimming of toenail, allowing toenail to grow out, and proper fitting shoes. ","Soak foot in warm, soapy water for 15 minutes 3x/day. Place cotton piece or dental floss under lateral nail to separate from nail fold. Apply hydrocortisone cream 1% to dry inflamed area after soaks. ","Consider duty limitations for up to 3 days as needed. ","RTC if symptoms are worsening or symptoms are not improved after 1 week."],
  J18LIMITATIONS = ["No running, rucking, or jumping","Walk at own pace/ distance"],
  J18GEN = ["pg. 146-147: An ingrown toenail is a nail that extends into the flesh of the toe along its lateral margins (nail fold). It can range from inflammation and tenderness to a significant infection."],
  J18MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)","All Medication Protocols Associated with 68W Training And Certifications pg.68(k)","Assists Privileged Provider To Perform Invasive Procedures pg.68(5)","Sets Up and Maintains A sterile Field pg.68(7)","Perform Wound Care pg.70(l)","Assists With The Administration of Local Anesthesia pg.70(r)","Assists In Performing Digital Block Procedures pg.70(s)","Perform Toenail Removal pg.70(t)"],
  J18STP1 = ["N/A"],

  K1ACT1 = [],
  K1ACT2 = [],
  K1ACT3 = [],
  K1DP1 = ["DP 2. A “yes” response to questions may indicate heat exhaustion which occurs as a result of an excessive loss of water and salt from the body. The syndrome is characterized by profuse perspiration, pallor, and perhaps low blood pressure. The mortality rate from this disorder, if treated, is extremely low. Moving the Soldier to a cool area for rest and the administration of fluids (orally or intravenous infusion, depending on severity of symptoms) will result in prompt recovery. Untreated heat exhaustion may progress to heatstroke."],
  K1DP2 = ["DP 3. A “yes” response to these questions indicates heat cramps. These are painful cramps of voluntary muscles which result from excessive loss of salt from the body. Muscles of the extremities and the abdominal wall are usually involved. Body temperature is normal. Heat cramps can be promptly relieved by replacing salt and fluid orally and placing the individual in a cool environment."],
  K1DP3 = ["MCP for mild heat injury. COOL: Place the Soldier in a cool or shaded place. HYDRATE: Give the Soldier at least one liter of cool water to drink in the first 30 minutes and then at least one liter of water per hour the next 2 hours. Advise the Soldier to decrease his activity for the next 24 hours. REASSESS: If the Soldier’s symptoms do not begin to resolve themselves within 30 minutes, if they get worse, or if the Soldier’s temperature exceeds 100.3OF, refer the Soldier to the supervising privileged provider."],
  K1DP4 = [],
  K1DPRE = [],
  K1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1. A “yes” response to any of the questions may indicate heatstroke with a breakdown of the body’s heat regulating mechanism. Heatstroke is characterized by high body temperature (>l03oF), altered mental status (that is, confusion, delirium, syncope and/or coma) and, in most cases, an absence of sweating. This condition has a high mortality rate and is a MEDICAL EMERGENCY. Lowering the body temperature is the most important treatment. Placing icepacks/ice sheets in the groin, arm pits and behind the neck, along with ice sheers under and on top the Soldier allows for rapid cooling. An alternative is dousing the Soldier with water and gently fanning to allow for evaporative cooling. Start an intravenous infusion. Monitor the Soldier’s body (rectal) temperature. Transport to an emergency treatment location, if available."],
  K1PRO = ["COOL: Place the Soldier in a cool or shaded place.","HYDRATE: Give the Soldier at least one liter of cool water to drink in the first 30 minutes and then at least one liter of water per hour the next 2 hours. Advise the Soldier to decrease his activity for the next 24 hours. ","REASSESS: If the Soldier's symptoms do not begin to resolve themselves within 30 minutes, if they get worse, or if the Soldier's temperature exceeds 101°F, Refer the Soldier to the privileged provider."],
  K1LIMITATIONS = ["No significant exercise x 48 hours","Limit exposure to hot environments"],
  K1GEN = ["pg. 148-149: Heat injury results from an excessive loss of water and salt from the body or a breakdown of the body’s cooling mechanism. Risks include inadequate acclimatization, illness, blood donation, poor physical fitness, obesity, using drugs such as antihistamines (Benadryl®, Atarax®, CTM®), decongestants (Sudafed®), high Blood Pressure (diuretics, beta blockers) and psychiatrics (tricyclic antidepressants, antipsychotics)."],
  K1MEDCOM = ["All Medication Protocols Associated with 68W Training And Certifications pg.68(k)","Initiate an Intravenous Infusion pg.69(2)(a)","Assists In The Initial Treatment Of Environmental Injuries pg.69(2)(e)"],
  K1STP1 = ["Subject Area 11: Force Health Protection. Initiate Treatment for a Heat Injury 081-833-0038"],

  K2ACT1 = ["Support ABCs","IVs","Transport horizontal on stretcher","Start Warming"],
  K2ACT2 = [],
  K2ACT3 = [],
  K2DP1 = ["DP 2. Symptoms of hypothermia with a normal temperature suggests an alternative diagnosis. Opioids, behavioral health medications, and alcohol can include medications for anxiety, depression, antipsychotics can impair thermoregulation. Severe pain associated with a nonfreezing cold injury requires further evaluation and management."],
  K2DP2 = ["Move Soldier to warm area. Remove wet clothing. Rewarm through utilizing body heat and space/hypothermia blanket. Do not place numb area by heat source (risk of burns)."],
  K2DP3 = [],
  K2DP4 = [],
  K2DPRE = ["DP 3. See Protocol K-3 for immersion foot. Immersion foot usually results when the skin is exposed to wet, cold foot gear or from immersion at temperatures from 32oF to 59oF for over two to three days (nonfreezing cold injury (NFCI) or immersion foot) and presents with a white, wrinkled, numb, painless extremity."],
  K2DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1. Mild hypothermia presents with T 90-95oF, normal mental status, tachycardia, tachypnea, and shivering. Moderate hypothermia presents with T 82-90oF, lethargy, bradycardia with arrhythmias, and hypoventilation without shivering. Severe hypothermia presents with T <82oF, coma, asystole, and apnea so that the Soldier may appear dead but resuscitation is still possible. Note any discrepancy between the extent of an abnormal vital sign and the degree of hypothermia may represent an underlying alternate cause for the vital sign abnormality like a head injury for confusion or hypovolemia for tachycardia. Frostbite may appear white or grayish-yellow and be hard or waxy to the touch. Support the Soldier’s airway, breathing, circulation, start two large bore IVs with warmed fluids, remove wet clothes, use body heat, blankets, and space/hypothermia blanket to rewarm, and transport horizontally. Low exertion of peripheral muscles can result in further drop in temperature."],
  K2PRO = ["Cold without criteria for hypothermia: move to warm area, remove wet clothes, and rewarm through body heat and space/hypothermia blanket. Monitor closely and elevate care if not improving within 30 minutes"],
  K2LIMITATIONS = ["Limit exposure to cold environments"],
  K2GEN = ["pg. 150-151: Hypothermia, or a lower than normal body temperature, can be the result of heat loss from exposure to cold or wet environments, inadequate heat production due to poor nutrition or exhaustion, or inaccurate heat regulation from using drugs such as nicotine, alcohol, and medications with anticholinergic side effects."],
  K2MEDCOM = ["All Medication Protocols Associated with 68W Training and Certifications pg.68(k)","Initiate an Intravenous Infusion pg.69(2)(a)","Identifies, reports and Treats Hypovolemia pg.69(2)(c)","Assists In The Initial Treatment Of Environmental Injuries pg.69(2)(e)"],
  K2STP1 = ["Subject Area 11: Force Health Protection. Treat a Casualty for a Cold Injury 081-833-0039"],

  K3ACT1 = ["Remove wet clothes","Rewarm the Soldier if hypothermic"],
  K3ACT2 = [],
  K3ACT3 = [],
  K3DP1 = ["DP 2: Symptoms lasting longer than one week will need a more in depth evaluation. If the Soldier is unable to perform duties, a profile for one week may initially be required."],
  K3DP2 = ["MCP for immersion foot. Rewarm the extremity gradually with bed rest, elevation of the extremity, and air drying at room temperature. Rapid warming can increase pain, swelling, and risk of further injury in the extremity. Limit activities with affected extremity and keep elevated for three days. Soldier may have a “slapping, flat footed” gait upon starting to walk that should improve within a week. Rehydrate with warm IV fluids and provide tetanus prophylaxis if required (discuss with AEM prior to giving). Ibuprofen, amitriptyline (requires a privileged provider prescription) as needed for pain. A fan to cool the affected extremity can also help with the pain. Refer to AEM if pain is not controlled. Return to clinic if new symptoms develop, condition worsens, signs of infection."],
  K3DP3 = [],
  K3DP4 = [],
  K3DPRE = [],
  K3DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Frostbite, hypothermia, and signs of gangrene represent a serious medical condition that requires prompt treatment. Severe pain or signs of an infection (such as, fever, red streaks, or swollen glands) require further evaluation by a privileged provider. Hypothermia should be rewarmed once the Soldier is under shelter and able to stay warm. Do Not rub the extremity. Do Not rewarm the extremity in NFCI unless frostbite is also present. During the exam, it is important to look for other injuries, especially in the setting of trauma."],
  K3PRO = ["Rest, elevate, and air dry affected extremity at room temperature. Limit activities for 3 days.","Rehydrate with warm IVF, Tetanus prophylaxis (AEM approval required). Toradol for moderate pain. Ibuprofen as needed for minor pain. Am itriptAne at night as needed for pain (provider prescription required).","RTC if symptoms are worsening, signs of infection, new symptoms developing, or symptoms are not controlled with the MCP not improving after 1 week."],
  K3LIMITATIONS = ["Limit activities for 3 days","elevate affected extremity x 3 days"],
  K3GEN = ["pg. 152-153: Immersion foot usually results when the skin is exposed to wet, cold foot gear or from immersion at temperatures from 32oF to 59oF for over 2-3 days NFCI or immersion foot. NFCI can result in an infection acutely or cold intolerance and pain syndromes chronically. Prolonged exposure to wet environments at temperatures greater than 59oF (jungle foot) can also result in acute pain or injury but typically do not cause chronic issues. Presentation is with a white, wrinkled, numb, painless extremity. After warmed, it becomes a mottled pale blue with delayed capillary refill and start of swelling (hours to days). Progresses to a red, swollen painful extremity with blisters in areas of tissue damage (days to weeks). Can remain sensitive to cold, painful to cold, cool to touch, excessive sweating, or painful for weeks to years."],
  K3MEDCOM = ["All Medication Protocols Associated with 68W Training and Certifications pg.68(k)","Initiate An Intravenous Infusion pg.69(2)(a)","Identifies, Reports And Treats Hypovolemia pg.69(2)(c)","Assists In The Initial Treatment Of Environmental Injuries pg.69(2)(e)"],
  K3STP1 = ["Subject Area 11: Force Health Protection. Treat a Casualty for a Cold Injury 081-833-0039"],

  K4ACT1 = [],
  K4ACT2 = [],
  K4ACT3 = [],
  K4DP1 = ["DP 1: Since exposure to dry wind causes chapping, involvement of areas other than the hands and face or not being exposed to dry wind makes this diagnosis unlikely, and the Soldier should be referred for further evaluation. Presence of inflammation other than simple skin redness warms of the possibility of infection and requires evaluation for possible antibiotics. Numbness can be a sign of a cold injury."],
  K4DP2 = ["MCP for chapped skin. Cover the exposed area so that it is no longer exposed to the drying wind. Apply moisturizing lotion (oil based cream or ointment). Apply Vaseline or lip balm to the lips. Moisturizing cream can also protect from further wind effects."],
  K4DP3 = [],
  K4DP4 = [],
  K4DPRE = [],
  K4DPRED = [],
  K4PRO = ["Cover affected skin area. Apply moisturizing lotion to affected area. Apply petroleum jelly or lip balm to the lips, if needed","RTC if symptoms are worsening, signs of infection, or new symptoms develop."],
  K4LIMITATIONS = [],
  K4GEN = ["pg. 154: Chapping is the unusually rapid drying of skin due to exposure to a hot or cold dry wind which draws water out of the skin. Generally, it is not a medical problem unless cracking or fissuring with a secondary infection takes place. The involved skin heals as new skin cells develop."],
  K4MEDCOM = ["All Medication Protocols Associated with 68W Training And Certifications pg.68(k)","Assists In The Initial Treatment Of Environmental Injuries pg.69(2)(e)"],
  K4STP1 = ["N/A"],

  K5ACT1 = ["Pad or splint affected area","Move Soldier to a warm area. Remove wet clothing","Rewarm using body heat and space/hypothermia blanket.","Do not rub area, place area near fire/heating element, or rewarm area if chance of refreezing","Tetanus prophylaxis"],
  K5ACT2 = [],
  K5ACT3 = [],
  K5DP1 = ["MCP initial frostbite treatment. Pad or splint the affected area. Avoid walking/standing on frostbitten feet. If walking required for evacuation, do not rewarm prior to walking. Move Soldier to warm area. Remove wet clothing. Do not rewarm frostbitten area if there is a possibility of the area refreezing. Rewarm with placing area in warm water or body heat and space/hypothermia blanket. Do not place frostbitten area by heat source (risk of burns with sensory loss) or rub the frostbitten area."],
  K5DP2 = [],
  K5DP3 = [],
  K5DP4 = [],
  K5DPRE = ["DP 2: If not hypothermia or frostbite, screen for trench foot (algorithm K-3)."],
  K5DPRED = ["DP 1: Presentation includes complaints of a cold, numb, and clumsy affected area. Area may appear white or grayish-yellow and be hard or waxy to the touch. Blisters or cyanosis will be present after rewarming."],
  K5PRO = [],
  K5LIMITATIONS = [],
  K5GEN = ["pg. 155: Frostbite results from the skin (usually on the toes, fingers, or face) being exposed to extreme cold for an extended period of time. Lower temperatures and high winds result in shorter times to injury. Immediate evaluation is required."],
  K5MEDCOM = ["N/A"],
  K5STP1 = ["N/A"],

  K6ACT1 = [],
  K6ACT2 = [],
  K6ACT3 = [],
  K6DP1 = ["DP 1: Secondary infection is common due associated itching. If nits and lice are not seen, then further evaluation is needed for a different diagnosis (contact dermatitis or scabies)."],
  K6DP2 = ["MCP for lice. Wash clothes, sleeping linens, sleeping bag in hot water (above 149oF) or have them dry cleaned. If unable to wash or dry clean, place in a sealed bag for two weeks.","MCP for body lice. Lice live on the seams of the clothing. Permethrin 5% application can also be used in addition to laundering the clothes.","MCP for head lice. Wash the area without using conditioner and towel dry. Apply permethrin cream to saturate the affected area. Leave on for 10 minutes. Rinse with warm (not hot) water. Use a close toothed comb to remove nits (eggs from base of hair follicles). Repeat in one week if nits or lice are still present.","MCP for pubis lice (such as, crabs). Screen for other STIs. Treat recent sexual contacts at the same time. Skin should be cool and dry. Apply Permethrin cream to all affected areas (groin, buttock, thighs, trunk, and axillae) for 10 minutes and then rinse off in warm water. Remove nits with tweezers or thin toothed comb. Follow-up in 10 days. If unable to follow-up, retreat with Permethrin cream in 10 days due to 40% of Soldiers not having cleared the infection with one treatment."],
  K6DP3 = [],
  K6DP4 = [],
  K6DPRE = [],
  K6DPRED = [],
  K6PRO = ["Launder clothes and bed linens in hot water. ","Body lice: apply perrnethrin 5% cream to body. ","Head lice: wash hair without conditioner and towel dry. Apply permethrin 1% cream. Leave on for 10 minutes. Rinse with warm water. Remove nits and dead lice with thin toothed comb. ","Pubis lice: screen for other STDs. Treat sexual partners at same time. Apply petrnethrin 1% cream to cool, dry areas (groin, buttock, upper thighs, trunk, axillae) for 10 minutes. Rinse with warm water. ","Follow-up in 10 days for repeat evaluation."],
  K6LIMITATIONS = [],
  K6GEN = ["pg. 156-157: Crabs/lice are tiny insects that are visible to the naked eye that infest the hairy areas of the body (such as, groin, body hair, and scalp). The insect deposits eggs (nits) and attaches them at the bases of hair shafts. The lice require a diet of human blood and will die within three days after removal from the body. The possibility of spreading infection to close associates by intimate contact or common use of clothing, beds, or toilet articles is real."],
  K6MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)","All Medication Protocols Associated with 68W Training And Certifications pg.68(k)"],
  K6STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125","Subject Area 18: Medication Administration. Administer Topical Medications 081-833-3020"],

  K7ACT1 = ["Epi pen if indicated"],
  K7ACT2 = [],
  K7ACT3 = [],
  K7DP1 = ["DP 2: If no signs of an insect bite can be seen, a blister or ulcer is present, or there is moderate to severe pain, refer to the AEM for further evaluation because it may be something other than an insect bite."],
  K7DP2 = ["MCP for Insect Bite. Remove any stinger, head of tick, or other biting apparatus left at the bite site. Clean with betadine solution.","Apply Calamine lotion or hydrocortisone 1% cream four times per day as needed for itching. Apply cold compress or ice pack as needed for swelling.","Return to clinic if symptoms worsen, new symptoms develop, or symptoms are not improving within 48 hours."],
  K7DP3 = [],
  K7DP4 = [],
  K7DPRE = [],
  K7DPRED = ["Red Flags. Wheezing, shortness of breath: immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Red flags, hives, or history of severe reaction from similar insect bite (such as, bee sting allergy), have Soldier inject epinephrine pen if indicated (signs of respiratory or circulatory compromise) and refer to a privileged provider immediately. Reported poisonous insect bite (brown recluse, black widow, etc.) should also be immediately referred."],
  K7PRO = [" Remove any stinger, head of tick, or other biting apparatus. Clean site with betadine solution. "," Apply calamine lotion or hydrocortisone 1% cream every 6 hours as needed for itching. Apply an ice pack as needed for swelling. "," RTC if symptoms worsen, new symptoms develop, or symptoms are not improving within 48 hours."],
  K7LIMITATIONS = [],
  K7GEN = ["pg. 158-159: Insect bites are characterized by itching, local swelling, mild pain, and redness. All of these reactions represent a local reaction to the sting of the insect. Document any history of tick bites and include the location of the bite."],
  K7MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)","All Medication Protocols Associated with 68W Training And Certifications pg.68(k)"],
  K7STP1 = ["Subject Area 11: Force Health Protection. Treat a Casualty for a Cold Injury 081-833-0039"],

  L1ACT1 = ["Wound care document exposure"],
  L1ACT2 = [],
  L1ACT3 = [],
  L1DP1 = ["DP 2: Feces, nasal secretions, saliva, gastric secretions, sputum, sweat, tears, and urine are not considered to be infectious without blood being present within them. Intact skin is a successful barrier to potentially infectious fluid. Note that cuts, abrasions, dermatitis are not considered intact skin. These exposures should be referred to the AEM for counseling and referral to a privileged provider if needed. Exposures that are over 7 days old are no longer within the window for prophylaxis treatment. They should be referred to the AEM for counseling and required laboratory testing."],
  L1DP2 = ["MCP for Initial Treatment of Exposure. For Soldiers who are exposed to blood or body fluids through a wound or mucous membrane, wash the area with soap and water or flush the mucous membranes with saline or water. Clean any wounds with an alcohol-based hand hygiene agent. Alcohol helps kills the HIV virus. Document the exposure with: source person and Soldier risk factors, serologic tests (HIV, Hepatitis B, Hepatitis C), type of exposure to include instrument (hollow bore needle, scalpel if indicated), time of incident, body fluid involved, body location of exposure to include depth of wound, and contact time with contaminated fluid. If the source person is known to be infected, it is important to determine the person’s most recent viral load and previous treatment to include drug resistance."],
  L1DP3 = [],
  L1DP4 = [],
  L1DPRE = [],
  L1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Known or high risk contacts for HIV should be offered prophylaxis medications to decrease the risk of infection if they had non-intact skin, mucous membrane, blood, or at risk body fluid exposures. Prophylaxis medications should be started within 2 hours of initial exposure but no later than 72 hours. With Hepatitis B, immunoglobulin should be provided within 24 hours of exposure but no later than 1 week. With Hepatitis C, post exposure management is with early detection and treatment of an infection."],
  L1PRO = ["Ensure the following information is documented in the Healthcare record before the patient leaves:","HCP — The following information should be obtained from the injured HCP and verified from their medical/occupational health record:","Dates of HepB immunizations","Post-immunization titer, if known","Previous testing (if available) for HBV and HCV","Tetanus immunization status","Current medications","Current or underlying medical conditions that might influence use of/response to vaccination","Exposure — The following information regarding the exposure should be obtained:","The date and time of the exposure","Nature of the exposure (i.e., non-intact skin, mucosal, percutaneous, human bite)","Type of fluid (i.e.. blood, blood contaminated fluid, or other contaminated fluid)","Body location of the exposure and contact time with the contaminated fluid","For percutaneous injuries, a description of the injury (e.g., depth of wound, solid versus hollow needle, sharp use in source patient)"],
  L1LIMITATIONS = [],
  L1GEN = ["pg. 160: This protocol is to be used in locations where a local policy is not already in place for the screening of potential HIV or Hepatitis exposures."],
  L1MEDCOM = ["N/A"],
  L1STP1 = ["N/A"],

  L2ACT1 = [],
  L2ACT2 = [],
  L2ACT3 = [],
  L2DP1 = ["DP 2: AEM can provide temporary pain medications and treatment for a broken tooth (pulp is not showing). Jaw pain not from trauma can be further evaluated by the AEM for temporomandibular joint dysfunction or infection."],
  L2DP2 = ["MCP for furry tongue. Benign condition often due to antibiotic use, tobacco use or poor oral hygiene. Treatment is to brush the area with toothpaste and a soft toothbrush three times per day. White patches on the oral mucosa (leukoplakia) is a benign condition often due to smokeless tobacco use or mechanical irritation (such as, braces, chewing). Instruct on importance of surveillance during dental visits, because there is a risk that it could progress to cancer over the next 10 years. If an area is indurated, refer to a dentist now to be evaluated to determine if a biopsy is necessary.","MCP for bad breath. Mostly commonly from poor oral hygiene and caused by bacteria on material between the teeth and on the back third of the tongue. It can also be related to eating certain types of food/ beverages, smoking, low saliva flow states (such as, sleeping, dry mouth), or infection/inflammation (such as, tonsils, sinuses, bronchitis). After obtaining a history, refer to a PCC or dentist, if indicated. Otherwise, instruct on the likely cause and importance of proper oral hygiene with brushing three times per day and flossing daily. Return to clinic if symptoms are not improving within one week or additional symptoms develop."],
  L2DP3 = [],
  L2DP4 = [],
  L2DPRE = [],
  L2DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Exposed pulp (that is, feathery material in middle of tooth), knocked out tooth with tooth present, severe pain, signs of oral infection (such as, redness, gum bleeding, swelling) should be referred to the dentist. Trauma with associated jaw pain, sinus problems with tooth pain, heart symptoms with jaw pain (such as, shortness of breath, sweating, lightheaded, chest pain/pressure), signs of face infection, or if the dentist is not available should be referred to the supervising privileged provider."],
  L2PRO = ["Furry Tongue- brush the tongue with toothpaste and a soft toothbrush 3 times per day.","White Plaque (leukoplakia): counsel Soldier on importance of surveillance during yearly dental exams. If an indurated area is present, Soldier should be referred to a dentist now.","Bad Breath: screen for causes of bad breath. Refer to provider or dentist if indicated. Otherwise, counsel on likely cause and importance of good oral hygiene. ","RTC if not improving within 1 week or net symptoms develop."],
  L2LIMITATIONS = [],
  L2GEN = ["pg. 162-163: Problems with the teeth are usually self-evident. Symptom of dental pain may be a result of a non-dental source such as myofascial inflammation, migraine headache, maxillary sinusitis, ear issues, temporomandibular joint pain, or nerve pain. Always inquire about other complaints before referring the Soldier to a dentist."],
  L2MEDCOM = ["All Medication Protocols Associated with 68W Training And Certifications pg.68(k)"],
  L2STP1 = ["N/A"],

  L3ACT1 = [],
  L3ACT2 = [],
  L3ACT3 = [],
  L3DP1 = ["DP 2: Herpes Simplex and Herpes Zoster can both presents as a cluster of ulcers. When it is within the mouth, refer the Soldier to the AEM for further evaluation. Large oral ulcers could be from other causes or require additional treatment"],
  L3DP2 = ["MCP for aphthous ulcer (canker sore). Most common oral ulcer. They present as small, painful, shallow, round or oval oral ulcers with a grayish base. Apply ¼ inch of triamcinolone oral paste to the ulcer at bedtime. It should resolve 10-14 days. Refer to the supervising privileged 3.0 if there is a history of severe stomach pain or bloody diarrhea.","MCP for hand, foot, and mouth disease. Common in children. It presents with oval pale papules with a red rim on the palms and soles of the feet with an aphthous ulcer. Elevated temperature, feeling tired, and a sore throat often start before the lesions appear. Treatment is supportive. Provide acetaminophen as needed for elevated temperature and Ibuprofen as needed for malaise. Cepacol lozenges, salt water gargles (1/4 teaspoon of salt in 1 cup of warm water), and drinking warm fluids may also help with the sore throat.","Instruct the Soldier to return to the clinic for further evaluation if new symptoms develop, symptoms worsen, or the symptoms are not controlled with the current regimen or resolved within 2 weeks."],
  L3DP3 = [],
  L3DP4 = [],
  L3DPRE = [],
  L3DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Diffuse lesions can be a sign of an inflammatory disorder (such as, Stevens-Johnson syndrome, erythema multiforme). Painless lesion can be a sign of Lupus. Lesions within the mouth and groin can represent Behcet’s syndrome. Mouth sores can be a sign of Crohn’s Disease requiring further evaluation by the supervising privileged provider. Lesions that have been present for over two weeks need further evaluation to rule out other causes."],
  L3PRO = ["Aphthous Ulcer: apply % inch of triamcinolone acetate oral paste to the ulcer at bedtime. It should resolve in 10-14 days. ","Hand, Foot, and Mouth Disease presents with lesions on the palms and soles of the feet. Provide toradol, acetaminophen every 6 hours as needed for fever, ibuprofen every 6 hours as needed for malaise, and lozenges or lidocaine gargle as needed for sore throat. ","RTC if symptoms are worsening, new symptoms developing, or symptoms are not controlled with the MCP or resolved within 2 weeks"],
  L3LIMITATIONS = [],
  L3GEN = ["pg. 164-165: Sores in the mouth are usually inflammatory or ulcerative in nature and may be associated with many upper respiratory infections or may result from trauma. Refer Soldiers with sores in the mouth to Category III care."],
  L3MEDCOM = ["All Medication Protocols Associated with 68W Training And Certifications pg.68(k)"],
  L3STP1 = ["N/A"],

  L4ACT1 = [],
  L4ACT2 = [],
  L4ACT3 = [],
  L4DP1 = ["DP 2: Acute conditions that have failed initial treatment should be referred to the AEM for further evaluation. Acute medication can be re-provided if the Soldier lost his or her medication. Prior to re-providing the medication, review the Soldier’s medical record to determine how much longer he or she is supposed to be on the medication"],
  L4DP2 = [],
  L4DP3 = [],
  L4DP4 = [],
  L4DPRE = [],
  L4DPRED = ["DP 1: Narcotics, psychiatric medications, sleeping medicines, birth control, and chronic medications should be referred to a privileged provider as a secure message or telephone consult. The privileged provider will need to determine if the underlying condition is still being adequately treated and when the next follow-up appointment is needed."],
  L4PRO = [],
  L4LIMITATIONS = [],
  L4GEN = ["pg. 166: Use this protocol for all prescription refills except birth control pills. Birth control is screened under I-6, Request for Information on Contraception. Some Soldiers request a refill of medication prescribed for an acute illness. Soldiers are normally given enough medication initially to cover the anticipated period of illness. If the Soldier wants additional medication, the illness may not be responding to the treatment as expected. In this case, the Soldier needs to be rescreened by his complaints. The only exception would be the Soldier who lost his original prescription."],
  L4MEDCOM = ["N/A"],
  L4STP1 = ["N/A"],

  L5ACT1 = [],
  L5ACT2 = [],
  L5ACT3 = [],
  L5DP1 = ["DP 2: Process to schedule a vasectomy varies by location. Message the privileged provider (secure messaging, T-con, etc.) to request a referral for the procedure or follow local process if different."],
  L5DP2 = [],
  L5DP3 = [],
  L5DP4 = [],
  L5DPRE = [],
  L5DPRED = ["DP 1: Vasectomy is for permanent birth control. If the Soldier is not in a stable relationship with acceptance of the other person, doesn’t already have kids, or is under 30 years old, then refer to the privileged provider for counseling prior to referring the Soldier for a vasectomy. If the privileged provider performs vasectomies, the privileged provider will need to counsel the Soldier before the procedure."],
  L5PRO = [],
  L5LIMITATIONS = [],
  L5GEN = ["pg. 167: Counseling should be provided to the Soldier prior to scheduling an appointment with the PCM or placing a Secure Message or T-con for a referral. Counseling should include a discussion on contraception, brief overview of the procedure, and emphasis on the permanent nature of the procedure.","Vasectomy is an outpatient procedure. It is often performed in an office or procedure room with local anesthesia and a sedating medication to help the Soldier relax. The skin of the scrotum is cut or punctured, a section of the vas deferens is removed, and the vas deferens ends are closed. After the procedure, the Soldier rests for two to four days with support of the scrotum and application of an ice pack to the area. Soldier doesn’t return to full duty for about 2 weeks.","A vasectomy is a permanent method of birth control. Reversal of the procedure is only about 50% effective and decreases with time. A vasectomy is not effective until after all of the sperm have been removed from the system. Lack of sperm needs to be confirmed by a lab test around three months. Alternate birth control will need to be used until the lack of sperm is confirmed. Pregnancy can still occur after vasectomy in 2% of people. Condoms are required to protect from STIs, if not in a committed monogamous relationship."],
  L5MEDCOM = ["N/A"],
  L5STP1 = ["N/A"],

  L6ACT1 = [],
  L6ACT2 = [],
  L6ACT3 = [],
  L6DP1 = ["If the clinic does not have the immunization requested, refer the Soldier to the appropriate location (such as, readiness clinic, immunizations, etc.). If the clinic does have the immunization and you are trained to provide it, obtain approval from your AEM. After obtaining approval, counsel the Soldier on the immunization, confirm that there are no contraindications, and provide the vaccine according to the package insert. After providing the vaccine, document the vaccination information in the appropriate databases or follow the local policy to have the information documented. Have the Soldier return to clinic if symptoms develop after the vaccination to include a rash, local redness or infection, or fever."],
  L6DP2 = [],
  L6DP3 = [],
  L6DP4 = [],
  L6DPRE = [],
  L6DPRED = ["DP 1: Rabies immunoglobulin needs to be referred to the supervising privileged provider. Routine immunizations are normally provided only at scheduled times. If the immunization is requested early, is not on the required immunization series, is contraindication, or you are not trained to provide, then refer the Soldier to the AEM. Contraindications include history of a severe reaction to a vaccine, eggs or egg protein, neomycin, or streptomycin. Being immunocompromised, around an immunocompromised person, or pregnant are contraindications that require further evaluation."],
  L6PRO = ["If you don't have the immunization, refer to the appropriate location (readiness clinic, immunization, etc.)","Obtain approval from the AEM. Counsel the patient on the vaccine. Confirm no contraindications. Provide the vaccine according to the package insert. ","Document the vaccination information in the required databases or follow local policy to have it documented. ","RTC if symptoms develop after the vaccine to include redness or infection at vaccine site, rash, anaphylaxis, seizure, or any other serious symptoms."],
  L6LIMITATIONS = [],
  L6GEN = ["pg. 168"],
  L6MEDCOM = ["Per Provider Order, Administers And Records Appropriate Immunizations pg.67 b.(1)"],
  L6STP1 = ["N/A"],

  L7ACT1 = [],
  L7ACT2 = [],
  L7ACT3 = [],
  L7DP1 = [],
  L7DP2 = [],
  L7DP3 = [],
  L7DP4 = [],
  L7DPRE = ["DP 2: Lymph nodes that are associated with an infection or inflammation should be screened according to the infection or inflammation symptoms."],
  L7DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1: Unexplained weight loss and enlarged nodes in multiple body areas may represent a systemic illness. Supraclavicular and posterior cervical may represent a more concerning illness. Non-mobile and hard or rubbery nodes may represent nodal fibrosis. Lack a recent infection (within two weeks) or inflammation in the area of the lymph node to cause the lymph node to enlarge requires further evaluation by the supervising privileged provider."],
  L7PRO = [],
  L7LIMITATIONS = [],
  L7GEN = ["pg. 169: Enlarged lymph nodes are most commonly found in the neck, armpits, and groin and are locations where the body fights infection. A lymph node enlargement may result from an infection/inflammation in the area of the body drained by the node or from a systemic illness. In the former case, the enlarged nodes are likely to be confined to that area. In the latter case, lymph nodes in several areas of the body may be involved."],
  L7MEDCOM = ["N/A"],
  L7STP1 = ["N/A"],

  L8ACT1 = ["Lay in dark, quiet room if BP elevated"],
  L8ACT2 = ["Start IVG if Orthostatic"],
  L8ACT3 = [],
  L8DP1 = ["DP 2: On the last day of the blood pressure check, refer the Soldier to the AEM to evaluate the recorded blood pressures. If it is not the last blood pressure check, remind the Soldier to return for his or her next check. Orthostatic hypotension is usually associated with feeling lightheaded upon standing and systolic blood pressure drops by 20, diastolic blood pressure drops by 10, or heart rate increases by 20 with standing."],
  L8DP2 = ["Continue to log BP until 5 day complete"],
  L8DP3 = [],
  L8DP4 = [],
  L8DPRE = [],
  L8DPRED = ["DP 1: If the blood pressure is greater than 150/90, recheck the blood pressure after five minutes. If it is still greater than 150/90 or was lower than 90 systolic refer the Soldier to a privileged provider for evaluation. Blood pressure over 180/120 is considered severe (hypertensive urgency) and requires prompt treatment. Severe hypertension can cause permanent end organ damage. Have the Soldier lay down in a dark, quiet room while awaiting for transport or to be seen by the privileged provider. A difference of greater than 15mmHg between arms suggests an arterial issue."],
  L8PRO = [],
  L8LIMITATIONS = [],
  L8GEN = ["pg. 170: Systolic blood pressure is the top number which is the pressure in the blood vessels when the heart is pumping blood to the body. Diastolic blood pressure is the bottom number which is the pressure in the blood vessels when the heart is filling with blood between pumps. A normal blood pressure is 120/70. Blood pressure can result in medical problems when it is elevated over a long period of time. It can also result in acute problems when it is very low or very high."],
  L8MEDCOM = ["N/A"],
  L8STP1 = ["Subject Area 1: Vital Signs. Measure a Patient’s Blood Pressure 081-833-0012"],

  L9ACT1 = [],
  L9ACT2 = [],
  L9ACT3 = [],
  L9DP1 = ["DP 2: Identification of a non-deployable profile, behavioral health appointments, specialty care appointments, or a pregnant or postpartum Soldier requires a referral to the supervising privileged provider for further evaluation prior to having the form signed. If no deficiencies or issues are identified, fill out the form for the supervising privileged provider to review and sign. Instruct the Soldier to wait or return at a later specified time depending on supervising privileged provider availability and local policy."],
  L9DP2 = [],
  L9DP3 = [],
  L9DP4 = [],
  L9DPRE = [],
  L9DPRED = ["DP 1: If MEDPROS is identified as being red, instruct the Soldier on how to correct the medical readiness deficiencies, and schedule an appointment as needed."],
  L9PRO = [],
  L9LIMITATIONS = [],
  L9GEN = ["pg. 171: Soldiers on orders for overseas assignments require review of their medical records to determine if they have medical conditions that would preclude the assignment and to ensure their medical readiness is current. Record review should look for behavioral health appointments, specialty care appointments, e-profile (non-deployable profile), deployment health assessments due, pregnancy status, and MEDPROS data. MEDPROS includes hearing, dental, immunizations, HIV screen, vision screen, and PHA."],
  L9MEDCOM = ["N/A"],
  L9STP1 = ["N/A"],

  L10ACT1 = ["Screening labs","IBHC referral","Dietician referral"],
  L10ACT2 = [],
  L10ACT3 = [],
  L10DP1 = ["DP 2: Soldiers who are requesting assistance with weight control that is a new issue should be provided information on community resources that are available which may include the Wellness Center, access to a Dietician, an Athletic Trainer, or Strength and Conditioning Coach and offered a referral to Integrated Behavioral Health if available."],
  L10DP2 = [],
  L10DP3 = [],
  L10DP4 = [],
  L10DPRE = [],
  L10DPRED = ["DP 1: Soldiers who are enrolled in the Army Body Composition Program (AR 600-9) are required to meet with a dietician or privileged provider if a dietician is not available. The privileged provider should screen the Soldier for medical causes of his or her weight gain. Screening labs include TSH, lipids, fasting glucose, and liver function tests. Hypothyroidism can cause weight gain and should be screened for with a TSH. Obesity is associated with diabetes, high cholesterol, and inflammation of the liver. Cholesterol, fasting glucose, and liver function tests should be screened to look for associated medical problems. Evaluation should also include screening for sleep apnea, hypertension, polycystic ovary syndrome, osteoarthritis, heartburn, and depression by history and physical exam. Soldier should be referred to the dietician while the lab results and privileged provider appointment are pending. Integrated Behavioral Health consult should be offered and information about other poster services (wellness centered) provided. Same screening should be performed for Soldiers who’s BMI is over 30, have been struggling to maintain their weight through multiple diets for over 6 months, or have a history of being placed on the Army Body Composition Program."],
  L10PRO = [],
  L10LIMITATIONS = [],
  L10GEN = ["pg. 172: Individuals who come on sick call requesting assistance with weight control or diet therapy to reduce their weight should be seen by a dietitian if there are no medical problems that require evaluation."],
  L10MEDCOM = ["Obtain Laboratory Specimen pg.70(k)"],
  L10STP1 = ["N/A"],

  L11ACT1 = [],
  L11ACT2 = [],
  L11ACT3 = [],
  L11DP1 = ["DP 2: If the complaint is not on the list, does not fit under another protocol, and the Soldier appears stable with normal vital signs, refer to the AEM for further evaluation, treatment, and disposition. If the complaint is not on the list but you recognize it as being under a protocol on the list or another way of saying a complaint that is on the list, screen according to the protocol that the Soldier’s complaint refers to."],
  L11DP2 = [],
  L11DP3 = [],
  L11DP4 = [],
  L11DPRE = ["DP 2: If the complaint is not on the list, does not fit under another protocol, and the Soldier appears stable with normal vital signs, refer to the AEM for further evaluation, treatment, and disposition. If the complaint is not on the list but you recognize it as being under a protocol on the list or another way of saying a complaint that is on the list, screen according to the protocol that the Soldier’s complaint refers to."],
  L11DPRED = ["DP 1: If Soldier appears sick or unstable (such as, pale, sweaty, dazed look in eyes), confused or has an altered mental status, uncomfortable (can’t stop moving or refusing to move due to pain), has abnormal vital signs, or describes pain as five or higher, refer to the supervising privileged provider now for further evaluation and treatment. All of these scenarios may represent a more significant illness or injury."],
  L11PRO = [],
  L11LIMITATIONS = [],
  L11GEN = ["pg. 173: Any Soldier with a complaint not covered in this screening manual requires further evaluation."],
  L11MEDCOM = ["N/A"],
  L11STP1 = ["Subject Area 1: Vital Signs. Measure a Patient’s Blood Pressure 081-833-0012"],

  L12ACT1 = ["Discuss with AEM"],
  L12ACT2 = ["Local SOP or Discuss with Provider"],
  L12ACT3 = [],
  L12DP1 = ["DP 2: If a Soldier is traveling on temporary duty to a location where medical care is not easily accessible and local policy supports providing travel medications, he or she may request a travel pack of medications. Evaluate for the risk of malaria and other diseases. Discuss the request with the supervising privileged provider. Provide travel medications as authorized by your supervising privileged provider and local policy."],
  L12DP2 = ["Example medications include ibuprofen (pain), diphenhydramine (allergies/ reaction), pseudoephedrine (congestion), loperamide and ciprofloxacin (diarrhea), doxycycline (malaria prophylaxis). Supervising privileged provider must approve all travel medications."],
  L12DP3 = [],
  L12DP4 = [],
  L12DPRE = ["DP 1: If the Soldier has symptoms, screen the Soldier according to the protocol that represents his or her symptoms. Since nonprescription medications can be dangerous if not used properly, the Soldier should be screened first to ensure that the medications requested are appropriate for his or her current symptoms."],
  L12DPRED = [],
  L12PRO = [],
  L12LIMITATIONS = [],
  L12GEN = ["pg. 174: This protocol refers to Soldiers requesting specific nonprescription medications for minor-care."],
  L12MEDCOM = ["All Medication Protocols Associated with 68W Training And Certifications pg.68(k)"],
  L12STP1 = ["Subject Area 1: Vital Signs. Measure a Patient’s Blood Pressure 081-833-0012"],

  M1ACT1 = [],
  M1ACT2 = [],
  M1ACT3 = [],
  M1DP1 = ["DP 2: Soldier should not be screened to below the AEM level when he or she returns to the clinic for the same issue that was previously treated with minor-care. Soldier has the option to elevate his or her disposition to the next higher level (Provider Now) if he or she feels uncomfortable with seeing an AEM."],
  M1DP2 = [],
  M1DP3 = [],
  M1DP4 = [],
  M1DPRE = [],
  M1DPRED = ["DP 1: If the Soldier is worsening on treatment or failed the previous treatment regimen, he or she should be referred to the supervising privileged provider."],
  M1PRO = [],
  M1LIMITATIONS = [],
  M1GEN = ["pg. 175: This refers to a Soldier who returns for further care not part of a scheduled follow-up. Soldier should NOT be screened to a minor-care protocol. As a follow-up visit, the Soldier should receive a more detailed evaluation and be seen by the privileged provider or AEM (if treated with a minor care protocol at the previous visit)."],
  M1MEDCOM = ["Subject Area 1: Vital Signs. Measure a Patient’s Blood Pressure 081-833-0012"],
  M1STP1 = ["N/A"],

  M2ACT1 = ["Rescreen if acutely ill"],
  M2ACT2 = ["Discuss with AEM"],
  M2ACT3 = [],
  M2DP1 = ["DP 2: If possible, refer the Soldier to the original privileged provider. If the original privileged provider is not available, discuss the situation with the AEM. Based on local policy and original privileged provider availability, the Soldier may be scheduled with a different privileged provider that is covering for the original privileged provider or scheduled with the original privileged provider when he or she is next available. Explain to the Soldier when his or her follow-up will be."],
  M2DP2 = [],
  M2DP3 = [],
  M2DP4 = [],
  M2DPRE = [],
  M2DPRED = ["DP 1: Rescreen the Soldier if he or she appears acutely ill. Refer to the supervising privileged provider if he or she is worsening, not improving, or screen as “Provider Now” in the protocol."],
  M2PRO = [],
  M2LIMITATIONS = [],
  M2GEN = ["pg. 176: Many Soldiers are told to return for follow up. Write the previous level of care and name of the privileged provider on the screening note."],
  M2MEDCOM = ["Subject Area 1: Vital Signs. Measure a Patient’s Blood Pressure 081-833-0012"],
  M2STP1 = ["N/A"],




end =[];
//anchor
//Array linking decision trees to the ul creation function
const A1decision = {  
  "DACT1" : A1ACT1,
  "DACT2" : A1ACT2,
  "DACT3" : A1ACT3,
  "DPRED" : A1DPRED,
  "DP1" : A1DP1,
  "DP2" : A1DP2,
  "DP3" : A1DP3,
  "DP4" : A1DP4,
  "DPRE" : A1DPRE,
  "DPRO" : A1PRO,
  "DLIM" : A1LIMITATIONS,
  "GEN" : A1GEN,
  "MED" : A1MEDCOM,
  "STP" : A1STP1,
  }


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
const C1decision = {
  "DACT1" : C1ACT1,
  "DACT2" : C1ACT2,
  "DACT3" : C1ACT3,
  "DPRED" : C1DPRED,
  "DP1" : C1DP1,
  "DP2" : C1DP2,
  "DP3" : C1DP3,
  "DP4" : C1DP4,
  "DPRE" : C1DPRE,
  "DPRO" : C1PRO,
  "DLIM" : C1LIMITATIONS,
  "GEN" : C1GEN,
  "MED" : C1MEDCOM,
  "STP" : C1STP1,
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
const E1decision = {
  "DACT1" : E1ACT1,
  "DACT2" : E1ACT2,
  "DACT3" : E1ACT3,
  "DPRED" : E1DPRED,
  "DP1" : E1DP1,
  "DP2" : E1DP2,
  "DP3" : E1DP3,
  "DP4" : E1DP4,
  "DPRE" : E1DPRE,
  "DPRO" : E1PRO,
  "DLIM" : E1LIMITATIONS,
  "GEN" : E1GEN,
  "MED" : E1MEDCOM,
  "STP" : E1STP1,
  }
const E2decision = {
"DACT1" : E2ACT1,
"DACT2" : E2ACT2,
"DACT3" : E2ACT3,
"DPRED" : E2DPRED,
"DP1" : E2DP1,
"DP2" : E2DP2,
"DP3" : E2DP3,
"DP4" : E2DP4,
"DPRE" : E2DPRE,
"DPRO" : E2PRO,
"DLIM" : E2LIMITATIONS,
"GEN" : E2GEN,
"MED" : E2MEDCOM,
"STP" : E2STP1,
}
const E3decision = {
"DACT1" : E3ACT1,
"DACT2" : E3ACT2,
"DACT3" : E3ACT3,
"DPRED" : E3DPRED,
"DP1" : E3DP1,
"DP2" : E3DP2,
"DP3" : E3DP3,
"DP4" : E3DP4,
"DPRE" : E3DPRE,
"DPRO" : E3PRO,
"DLIM" : E3LIMITATIONS,
"GEN" : E3GEN,
"MED" : E3MEDCOM,
"STP" : E3STP1,
}

const E4decision = {
  "DACT1" : E4ACT1,
  "DACT2" : E4ACT2,
  "DACT3" : E4ACT3,
  "DPRED" : E4DPRED,
  "DP1" : E4DP1,
  "DP2" : E4DP2,
  "DP3" : E4DP3,
  "DP4" : E4DP4,
  "DPRE" : E4DPRE,
  "DPRO" : E4PRO,
  "DLIM" : E4LIMITATIONS,
  "GEN" : E4GEN,
  "MED" : E4MEDCOM,
  "STP" : E4STP1,
  }
const F1decision = {
  "DACT1" : F1ACT1,
  "DACT2" : F1ACT2,
  "DACT3" : F1ACT3,
  "DPRED" : F1DPRED,
  "DP1" : F1DP1,
  "DP2" : F1DP2,
  "DP3" : F1DP3,
  "DP4" : F1DP4,
  "DPRE" : F1DPRE,
  "DPRO" : F1PRO,
  "DLIM" : F1LIMITATIONS,
  "GEN" : F1GEN,
  "MED" : F1MEDCOM,
  "STP" : F1STP1,
  }

  const F2decision = {
    "DACT1" : F2ACT1,
    "DACT2" : F2ACT2,
    "DACT3" : F2ACT3,
    "DPRED" : F2DPRED,
    "DP1" : F2DP1,
    "DP2" : F2DP2,
    "DP3" : F2DP3,
    "DP4" : F2DP4,
    "DPRE" : F2DPRE,
    "DPRO" : F2PRO,
    "DLIM" : F2LIMITATIONS,
    "GEN" : F2GEN,
    "MED" : F2MEDCOM,
    "STP" : F2STP1,
    }

const F3decision = {
  "DACT1" : F3ACT1,
  "DACT2" : F3ACT2,
  "DACT3" : F3ACT3,
  "DPRED" : F3DPRED,
  "DP1" : F3DP1,
  "DP2" : F3DP2,
  "DP3" : F3DP3,
  "DP4" : F3DP4,
  "DPRE" : F3DPRE,
  "DPRO" : F3PRO,
  "DLIM" : F3LIMITATIONS,
  "GEN" : F3GEN,
  "MED" : F3MEDCOM,
  "STP" : F3STP1,
  }

const F4decision = {
  "DACT1" : F4ACT1,
  "DACT2" : F4ACT2,
  "DACT3" : F4ACT3,
  "DPRED" : F4DPRED,
  "DP1" : F4DP1,
  "DP2" : F4DP2,
  "DP3" : F4DP3,
  "DP4" : F4DP4,
  "DPRE" : F4DPRE,
  "DPRO" : F4PRO,
  "DLIM" : F4LIMITATIONS,
  "GEN" : F4GEN,
  "MED" : F4MEDCOM,
  "STP" : F4STP1,
  }
const F5decision = {
  "DACT1" : F5ACT1,
  "DACT2" : F5ACT2,
  "DACT3" : F5ACT3,
  "DPRED" : F5DPRED,
  "DP1" : F5DP1,
  "DP2" : F5DP2,
  "DP3" : F5DP3,
  "DP4" : F5DP4,
  "DPRE" : F5DPRE,
  "DPRO" : F5PRO,
  "DLIM" : F5LIMITATIONS,
  "GEN" : F5GEN,
  "MED" : F5MEDCOM,
  "STP" : F5STP1,
  }

  const F6decision ={
    "DACT1" : F6ACT1,
  "DACT2" : F6ACT2,
  "DACT3" : F6ACT3,
  "DPRED" : F6DPRED,
  "DP1" : F6DP1,
  "DP2" : F6DP2,
  "DP3" : F6DP3,
  "DP4" : F6DP4,
  "DPRE" : F6DPRE,
  "DPRO" : F6PRO,
  "DLIM" : F6LIMITATIONS,
  "GEN" : F6GEN,
  "MED" : F6MEDCOM,
  "STP" : F6STP1,
  }
  const G1decision ={
    "DACT1" : G1ACT1,
  "DACT2" : G1ACT2,
  "DACT3" : G1ACT3,
  "DPRED" : G1DPRED,
  "DP1" : G1DP1,
  "DP2" : G1DP2,
  "DP3" : G1DP3,
  "DP4" : G1DP4,
  "DPRE" : G1DPRE,
  "DPRO" : G1PRO,
  "DLIM" : G1LIMITATIONS,
  "GEN" : G1GEN,
  "MED" : G1MEDCOM,
  "STP" : G1STP1,
  }
  const G2decision ={
    "DACT1" : G2ACT1,
  "DACT2" : G2ACT2,
  "DACT3" : G2ACT3,
  "DPRED" : G2DPRED,
  "DP1" : G2DP1,
  "DP2" : G2DP2,
  "DP3" : G2DP3,
  "DP4" : G2DP4,
  "DPRE" : G2DPRE,
  "DPRO" : G2PRO,
  "DLIM" : G2LIMITATIONS,
  "GEN" : G2GEN,
  "MED" : G2MEDCOM,
  "STP" : G2STP1,
  }
  const H1decision ={
    "DACT1" : H1ACT1,
  "DACT2" : H1ACT2,
  "DACT3" : H1ACT3,
  "DPRED" : H1DPRED,
  "DP1" : H1DP1,
  "DP2" : H1DP2,
  "DP3" : H1DP3,
  "DP4" : H1DP4,
  "DPRE" : H1DPRE,
  "DPRO" : H1PRO,
  "DLIM" : H1LIMITATIONS,
  "GEN" : H1GEN,
  "MED" : H1MEDCOM,
  "STP" : H1STP1,
  }
  const H2decision ={
    "DACT1" : H2ACT1,
  "DACT2" : H2ACT2,
  "DACT3" : H2ACT3,
  "DPRED" : H2DPRED,
  "DP1" : H2DP1,
  "DP2" : H2DP2,
  "DP3" : H2DP3,
  "DP4" : H2DP4,
  "DPRE" : H2DPRE,
  "DPRO" : H2PRO,
  "DLIM" : H2LIMITATIONS,
  "GEN" : H2GEN,
  "MED" : H2MEDCOM,
  "STP" : H2STP1,
  }
  const H3decision ={
    "DACT1" : H3ACT1,
  "DACT2" : H3ACT2,
  "DACT3" : H3ACT3,
  "DPRED" : H3DPRED,
  "DP1" : H3DP1,
  "DP2" : H3DP2,
  "DP3" : H3DP3,
  "DP4" : H3DP4,
  "DPRE" : H3DPRE,
  "DPRO" : H3PRO,
  "DLIM" : H3LIMITATIONS,
  "GEN" : H3GEN,
  "MED" : H3MEDCOM,
  "STP" : H3STP1,
  }
  const H4decision ={
    "DACT1" : H4ACT1,
  "DACT2" : H4ACT2,
  "DACT3" : H4ACT3,
  "DPRED" : H4DPRED,
  "DP1" : H4DP1,
  "DP2" : H4DP2,
  "DP3" : H4DP3,
  "DP4" : H4DP4,
  "DPRE" : H4DPRE,
  "DPRO" : H4PRO,
  "DLIM" : H4LIMITATIONS,
  "GEN" : H4GEN,
  "MED" : H4MEDCOM,
  "STP" : H4STP1,
  }
  const I1decision ={
    "DACT1" : I1ACT1,
  "DACT2" : I1ACT2,
  "DACT3" : I1ACT3,
  "DPRED" : I1DPRED,
  "DP1" : I1DP1,
  "DP2" : I1DP2,
  "DP3" : I1DP3,
  "DP4" : I1DP4,
  "DPRE" : I1DPRE,
  "DPRO" : I1PRO,
  "DLIM" : I1LIMITATIONS,
  "GEN" : I1GEN,
  "MED" : I1MEDCOM,
  "STP" : I1STP1,
  }
  const I2decision ={
    "DACT1" : I2ACT1,
  "DACT2" : I2ACT2,
  "DACT3" : I2ACT3,
  "DPRED" : I2DPRED,
  "DP1" : I2DP1,
  "DP2" : I2DP2,
  "DP3" : I2DP3,
  "DP4" : I2DP4,
  "DPRE" : I2DPRE,
  "DPRO" : I2PRO,
  "DLIM" : I2LIMITATIONS,
  "GEN" : I2GEN,
  "MED" : I2MEDCOM,
  "STP" : I2STP1,
  }
  const I3decision ={
    "DACT1" : I3ACT1,
  "DACT2" : I3ACT2,
  "DACT3" : I3ACT3,
  "DPRED" : I3DPRED,
  "DP1" : I3DP1,
  "DP2" : I3DP2,
  "DP3" : I3DP3,
  "DP4" : I3DP4,
  "DPRE" : I3DPRE,
  "DPRO" : I3PRO,
  "DLIM" : I3LIMITATIONS,
  "GEN" : I3GEN,
  "MED" : I3MEDCOM,
  "STP" : I3STP1,
  }
  const I4decision ={
    "DACT1" : I4ACT1,
  "DACT2" : I4ACT2,
  "DACT3" : I4ACT3,
  "DPRED" : I4DPRED,
  "DP1" : I4DP1,
  "DP2" : I4DP2,
  "DP3" : I4DP3,
  "DP4" : I4DP4,
  "DPRE" : I4DPRE,
  "DPRO" : I4PRO,
  "DLIM" : I4LIMITATIONS,
  "GEN" : I4GEN,
  "MED" : I4MEDCOM,
  "STP" : I4STP1,
  }
  const I5decision ={
    "DACT1" : I5ACT1,
  "DACT2" : I5ACT2,
  "DACT3" : I5ACT3,
  "DPRED" : I5DPRED,
  "DP1" : I5DP1,
  "DP2" : I5DP2,
  "DP3" : I5DP3,
  "DP4" : I5DP4,
  "DPRE" : I5DPRE,
  "DPRO" : I5PRO,
  "DLIM" : I5LIMITATIONS,
  "GEN" : I5GEN,
  "MED" : I5MEDCOM,
  "STP" : I5STP1,
  }

  const I6decision ={
    "DACT1" : I6ACT1,
  "DACT2" : I6ACT2,
  "DACT3" : I6ACT3,
  "DPRED" : I6DPRED,
  "DP1" : I6DP1,
  "DP2" : I6DP2,
  "DP3" : I6DP3,
  "DP4" : I6DP4,
  "DPRE" : I6DPRE,
  "DPRO" : I6PRO,
  "DLIM" : I6LIMITATIONS,
  "GEN" : I6GEN,
  "MED" : I6MEDCOM,
  "STP" : I6STP1,
  }
  
  const J1decision ={
    "DACT1" :J1ACT1,
  "DACT2" : J1ACT2,
  "DACT3" : J1ACT3,
  "DPRED" : J1DPRED,
  "DP1" : J1DP1,
  "DP2" : J1DP2,
  "DP3" : J1DP3,
  "DP4" : J1DP4,
  "DPRE" : J1DPRE,
  "DPRO" : J1PRO,
  "DLIM" : J1LIMITATIONS,
  "GEN" : J1GEN,
  "MED" : J1MEDCOM,
  "STP" : J1STP1,
  }

  const J2decision ={
    "DACT1" :J2ACT1,
  "DACT2" : J2ACT2,
  "DACT3" : J2ACT3,
  "DPRED" : J2DPRED,
  "DP1" : J2DP1,
  "DP2" : J2DP2,
  "DP3" : J2DP3,
  "DP4" : J2DP4,
  "DPRE" : J2DPRE,
  "DPRO" : J2PRO,
  "DLIM" : J2LIMITATIONS,
  "GEN" : J2GEN,
  "MED" : J2MEDCOM,
  "STP" : J2STP1,
  }


  const J3decision ={
    "DACT1" :J3ACT1,
  "DACT2" : J3ACT2,
  "DACT3" : J3ACT3,
  "DPRED" : J3DPRED,
  "DP1" : J3DP1,
  "DP2" : J3DP2,
  "DP3" : J3DP3,
  "DP4" : J3DP4,
  "DPRE" : J3DPRE,
  "DPRO" : J3PRO,
  "DLIM" : J3LIMITATIONS,
  "GEN" : J3GEN,
  "MED" : J3MEDCOM,
  "STP" : J3STP1,
  }


  const J4decision ={
    "DACT1" :J4ACT1,
  "DACT2" : J4ACT2,
  "DACT3" : J4ACT3,
  "DPRED" : J4DPRED,
  "DP1" : J4DP1,
  "DP2" : J4DP2,
  "DP3" : J4DP3,
  "DP4" : J4DP4,
  "DPRE" : J4DPRE,
  "DPRO" : J4PRO,
  "DLIM" : J4LIMITATIONS,
  "GEN" : J4GEN,
  "MED" : J4MEDCOM,
  "STP" : J4STP1,
  }


  const J5decision ={
    "DACT1" :J5ACT1,
  "DACT2" : J5ACT2,
  "DACT3" : J5ACT3,
  "DPRED" : J5DPRED,
  "DP1" : J5DP1,
  "DP2" : J5DP2,
  "DP3" : J5DP3,
  "DP4" : J5DP4,
  "DPRE" : J5DPRE,
  "DPRO" : J5PRO,
  "DLIM" : J5LIMITATIONS,
  "GEN" : J5GEN,
  "MED" : J5MEDCOM,
  "STP" : J5STP1,
  }


  const J6decision ={
    "DACT1" :J6ACT1,
  "DACT2" : J6ACT2,
  "DACT3" : J6ACT3,
  "DPRED" : J6DPRED,
  "DP1" : J6DP1,
  "DP2" : J6DP2,
  "DP3" : J6DP3,
  "DP4" : J6DP4,
  "DPRE" : J6DPRE,
  "DPRO" : J6PRO,
  "DLIM" : J6LIMITATIONS,
  "GEN" : J6GEN,
  "MED" : J6MEDCOM,
  "STP" : J6STP1,
  }


  const J7decision ={
    "DACT1" :J7ACT1,
  "DACT2" : J7ACT2,
  "DACT3" : J7ACT3,
  "DPRED" : J7DPRED,
  "DP1" : J7DP1,
  "DP2" : J7DP2,
  "DP3" : J7DP3,
  "DP4" : J7DP4,
  "DPRE" : J7DPRE,
  "DPRO" : J7PRO,
  "DLIM" : J7LIMITATIONS,
  "GEN" : J7GEN,
  "MED" : J7MEDCOM,
  "STP" : J7STP1,
  }


  const J8decision ={
    "DACT1" :J8ACT1,
  "DACT2" : J8ACT2,
  "DACT3" : J8ACT3,
  "DPRED" : J8DPRED,
  "DP1" : J8DP1,
  "DP2" : J8DP2,
  "DP3" : J8DP3,
  "DP4" : J8DP4,
  "DPRE" : J8DPRE,
  "DPRO" : J8PRO,
  "DLIM" : J8LIMITATIONS,
  "GEN" : J8GEN,
  "MED" : J8MEDCOM,
  "STP" : J8STP1,
  }


  const J9decision ={
    "DACT1" :J9ACT1,
  "DACT2" : J9ACT2,
  "DACT3" : J9ACT3,
  "DPRED" : J9DPRED,
  "DP1" : J9DP1,
  "DP2" : J9DP2,
  "DP3" : J9DP3,
  "DP4" : J9DP4,
  "DPRE" : J9DPRE,
  "DPRO" : J9PRO,
  "DLIM" : J9LIMITATIONS,
  "GEN" : J9GEN,
  "MED" : J9MEDCOM,
  "STP" : J9STP1,
  }


  const J10decision ={
    "DACT1" : J10ACT1,
  "DACT2" : J10ACT2,
  "DACT3" : J10ACT3,
  "DPRED" : J10DPRED,
  "DP1" : J10DP1,
  "DP2" : J10DP2,
  "DP3" : J10DP3,
  "DP4" : J10DP4,
  "DPRE" : J10DPRE,
  "DPRO" : J10PRO,
  "DLIM" : J10LIMITATIONS,
  "GEN" : J10GEN,
  "MED" : J10MEDCOM,
  "STP" : J10STP1,
  }


  const J11decision ={
    "DACT1" : J11ACT1,
  "DACT2" : J11ACT2,
  "DACT3" : J11ACT3,
  "DPRED" : J11DPRED,
  "DP1" : J11DP1,
  "DP2" : J11DP2,
  "DP3" : J11DP3,
  "DP4" : J11DP4,
  "DPRE" : J11DPRE,
  "DPRO" : J11PRO,
  "DLIM" : J11LIMITATIONS,
  "GEN" : J11GEN,
  "MED" : J11MEDCOM,
  "STP" : J11STP1,
  }


  const J12decision ={
    "DACT1" : J12ACT1,
  "DACT2" : J12ACT2,
  "DACT3" : J12ACT3,
  "DPRED" : J12DPRED,
  "DP1" : J12DP1,
  "DP2" : J12DP2,
  "DP3" : J12DP3,
  "DP4" : J12DP4,
  "DPRE" : J12DPRE,
  "DPRO" : J12PRO,
  "DLIM" : J12LIMITATIONS,
  "GEN" : J12GEN,
  "MED" : J12MEDCOM,
  "STP" : J12STP1,
  }


  const J13decision ={
    "DACT1" : J13ACT1,
  "DACT2" : J13ACT2,
  "DACT3" : J13ACT3,
  "DPRED" : J13DPRED,
  "DP1" : J13DP1,
  "DP2" : J13DP2,
  "DP3" : J13DP3,
  "DP4" : J13DP4,
  "DPRE" : J13DPRE,
  "DPRO" : J13PRO,
  "DLIM" : J13LIMITATIONS,
  "GEN" : J13GEN,
  "MED" : J13MEDCOM,
  "STP" : J13STP1,
  }


  const J14decision ={
    "DACT1" : J14ACT1,
  "DACT2" : J14ACT2,
  "DACT3" : J14ACT3,
  "DPRED" : J14DPRED,
  "DP1" : J14DP1,
  "DP2" : J14DP2,
  "DP3" : J14DP3,
  "DP4" : J14DP4,
  "DPRE" : J14DPRE,
  "DPRO" : J14PRO,
  "DLIM" : J14LIMITATIONS,
  "GEN" : J14GEN,
  "MED" : J14MEDCOM,
  "STP" : J14STP1,
  }


  const J15decision ={
    "DACT1" : J15ACT1,
  "DACT2" : J15ACT2,
  "DACT3" : J15ACT3,
  "DPRED" : J15DPRED,
  "DP1" : J15DP1,
  "DP2" : J15DP2,
  "DP3" : J15DP3,
  "DP4" : J15DP4,
  "DPRE" : J15DPRE,
  "DPRO" : J15PRO,
  "DLIM" : J15LIMITATIONS,
  "GEN" : J15GEN,
  "MED" : J15MEDCOM,
  "STP" : J15STP1,
  }


  const J16decision ={
    "DACT1" : J16ACT1,
  "DACT2" : J16ACT2,
  "DACT3" : J16ACT3,
  "DPRED" : J16DPRED,
  "DP1" : J16DP1,
  "DP2" : J16DP2,
  "DP3" : J16DP3,
  "DP4" : J16DP4,
  "DPRE" : J16DPRE,
  "DPRO" : J16PRO,
  "DLIM" : J16LIMITATIONS,
  "GEN" : J16GEN,
  "MED" : J16MEDCOM,
  "STP" : J16STP1,
  }


  const J17decision ={
    "DACT1" : J17ACT1,
  "DACT2" : J17ACT2,
  "DACT3" : J17ACT3,
  "DPRED" : J17DPRED,
  "DP1" : J17DP1,
  "DP2" : J17DP2,
  "DP3" : J17DP3,
  "DP4" : J17DP4,
  "DPRE" : J17DPRE,
  "DPRO" : J17PRO,
  "DLIM" : J17LIMITATIONS,
  "GEN" : J17GEN,
  "MED" : J17MEDCOM,
  "STP" : J17STP1,
  }


  const J18decision ={
    "DACT1" : J18ACT1,
  "DACT2" : J18ACT2,
  "DACT3" : J18ACT3,
  "DPRED" : J18DPRED,
  "DP1" : J18DP1,
  "DP2" : J18DP2,
  "DP3" : J18DP3,
  "DP4" : J18DP4,
  "DPRE" : J18DPRE,
  "DPRO" : J18PRO,
  "DLIM" : J18LIMITATIONS,
  "GEN" : J18GEN,
  "MED" : J18MEDCOM,
  "STP" : J18STP1,
  }

  const K1decision ={
    "DACT1" : K1ACT1,
  "DACT2" : K1ACT2,
  "DACT3" : K1ACT3,
  "DPRED" : K1DPRED,
  "DP1" : K1DP1,
  "DP2" : K1DP2,
  "DP3" : K1DP3,
  "DP4" : K1DP4,
  "DPRE" : K1DPRE,
  "DPRO" : K1PRO,
  "DLIM" : K1LIMITATIONS,
  "GEN" : K1GEN,
  "MED" : K1MEDCOM,
  "STP" : K1STP1,
  }

  const K2decision ={
    "DACT1" : K2ACT1,
  "DACT2" : K2ACT2,
  "DACT3" : K2ACT3,
  "DPRED" : K2DPRED,
  "DP1" : K2DP1,
  "DP2" : K2DP2,
  "DP3" : K2DP3,
  "DP4" : K2DP4,
  "DPRE" : K2DPRE,
  "DPRO" : K2PRO,
  "DLIM" : K2LIMITATIONS,
  "GEN" : K2GEN,
  "MED" : K2MEDCOM,
  "STP" : K2STP1,
  }

  const K3decision ={
    "DACT1" : K3ACT1,
  "DACT2" : K3ACT2,
  "DACT3" : K3ACT3,
  "DPRED" : K3DPRED,
  "DP1" : K3DP1,
  "DP2" : K3DP2,
  "DP3" : K3DP3,
  "DP4" : K3DP4,
  "DPRE" : K3DPRE,
  "DPRO" : K3PRO,
  "DLIM" : K3LIMITATIONS,
  "GEN" : K3GEN,
  "MED" : K3MEDCOM,
  "STP" : K3STP1,
  }

  const K4decision ={
    "DACT1" : K4ACT1,
  "DACT2" : K4ACT2,
  "DACT3" : K4ACT3,
  "DPRED" : K4DPRED,
  "DP1" : K4DP1,
  "DP2" : K4DP2,
  "DP3" : K4DP3,
  "DP4" : K4DP4,
  "DPRE" : K4DPRE,
  "DPRO" : K4PRO,
  "DLIM" : K4LIMITATIONS,
  "GEN" : K4GEN,
  "MED" : K4MEDCOM,
  "STP" : K4STP1,
  }

  const K5decision ={
    "DACT1" : K5ACT1,
  "DACT2" : K5ACT2,
  "DACT3" : K5ACT3,
  "DPRED" : K5DPRED,
  "DP1" : K5DP1,
  "DP2" : K5DP2,
  "DP3" : K5DP3,
  "DP4" : K5DP4,
  "DPRE" : K5DPRE,
  "DPRO" : K5PRO,
  "DLIM" : K5LIMITATIONS,
  "GEN" : K5GEN,
  "MED" : K5MEDCOM,
  "STP" : K5STP1,
  }

  const K6decision ={
    "DACT1" : K6ACT1,
  "DACT2" : K6ACT2,
  "DACT3" : K6ACT3,
  "DPRED" : K6DPRED,
  "DP1" : K6DP1,
  "DP2" : K6DP2,
  "DP3" : K6DP3,
  "DP4" : K6DP4,
  "DPRE" : K6DPRE,
  "DPRO" : K6PRO,
  "DLIM" : K6LIMITATIONS,
  "GEN" : K6GEN,
  "MED" : K6MEDCOM,
  "STP" : K6STP1,
  }

  const K7decision ={
    "DACT1" : K7ACT1,
  "DACT2" : K7ACT2,
  "DACT3" : K7ACT3,
  "DPRED" : K7DPRED,
  "DP1" : K7DP1,
  "DP2" : K7DP2,
  "DP3" : K7DP3,
  "DP4" : K7DP4,
  "DPRE" : K7DPRE,
  "DPRO" : K7PRO,
  "DLIM" : K7LIMITATIONS,
  "GEN" : K7GEN,
  "MED" : K7MEDCOM,
  "STP" : K7STP1,
  }

  const L1decision ={
    "DACT1" : L1ACT1,
  "DACT2" : L1ACT2,
  "DACT3" : L1ACT3,
  "DPRED" : L1DPRED,
  "DP1" : L1DP1,
  "DP2" : L1DP2,
  "DP3" : L1DP3,
  "DP4" : L1DP4,
  "DPRE" : L1DPRE,
  "DPRO" : L1PRO,
  "DLIM" : L1LIMITATIONS,
  "GEN" : L1GEN,
  "MED" : L1MEDCOM,
  "STP" : L1STP1,
  }

  const L2decision ={
    "DACT1" : L2ACT1,
  "DACT2" : L2ACT2,
  "DACT3" : L2ACT3,
  "DPRED" : L2DPRED,
  "DP1" : L2DP1,
  "DP2" : L2DP2,
  "DP3" : L2DP3,
  "DP4" : L2DP4,
  "DPRE" : L2DPRE,
  "DPRO" : L2PRO,
  "DLIM" : L2LIMITATIONS,
  "GEN" : L2GEN,
  "MED" : L2MEDCOM,
  "STP" : L2STP1,
  }

  const L3decision ={
    "DACT1" : L3ACT1,
  "DACT2" : L3ACT2,
  "DACT3" : L3ACT3,
  "DPRED" : L3DPRED,
  "DP1" : L3DP1,
  "DP2" : L3DP2,
  "DP3" : L3DP3,
  "DP4" : L3DP4,
  "DPRE" : L3DPRE,
  "DPRO" : L3PRO,
  "DLIM" : L3LIMITATIONS,
  "GEN" : L3GEN,
  "MED" : L3MEDCOM,
  "STP" : L3STP1,
  }

  const L4decision ={
    "DACT1" : L4ACT1,
  "DACT2" : L4ACT2,
  "DACT3" : L4ACT3,
  "DPRED" : L4DPRED,
  "DP1" : L4DP1,
  "DP2" : L4DP2,
  "DP3" : L4DP3,
  "DP4" : L4DP4,
  "DPRE" : L4DPRE,
  "DPRO" : L4PRO,
  "DLIM" : L4LIMITATIONS,
  "GEN" : L4GEN,
  "MED" : L4MEDCOM,
  "STP" : L4STP1,
  }

  const L5decision ={
    "DACT1" : L5ACT1,
  "DACT2" : L5ACT2,
  "DACT3" : L5ACT3,
  "DPRED" : L5DPRED,
  "DP1" : L5DP1,
  "DP2" : L5DP2,
  "DP3" : L5DP3,
  "DP4" : L5DP4,
  "DPRE" : L5DPRE,
  "DPRO" : L5PRO,
  "DLIM" : L5LIMITATIONS,
  "GEN" : L5GEN,
  "MED" : L5MEDCOM,
  "STP" : L5STP1,
  }

  const L6decision ={
    "DACT1" : L6ACT1,
  "DACT2" : L6ACT2,
  "DACT3" : L6ACT3,
  "DPRED" : L6DPRED,
  "DP1" : L6DP1,
  "DP2" : L6DP2,
  "DP3" : L6DP3,
  "DP4" : L6DP4,
  "DPRE" : L6DPRE,
  "DPRO" : L6PRO,
  "DLIM" : L6LIMITATIONS,
  "GEN" : L6GEN,
  "MED" : L6MEDCOM,
  "STP" : L6STP1,
  }

  const L7decision ={
    "DACT1" : L7ACT1,
  "DACT2" : L7ACT2,
  "DACT3" : L7ACT3,
  "DPRED" : L7DPRED,
  "DP1" : L7DP1,
  "DP2" : L7DP2,
  "DP3" : L7DP3,
  "DP4" : L7DP4,
  "DPRE" : L7DPRE,
  "DPRO" : L7PRO,
  "DLIM" : L7LIMITATIONS,
  "GEN" : L7GEN,
  "MED" : L7MEDCOM,
  "STP" : L7STP1,
  }

  const L8decision ={
    "DACT1" : L8ACT1,
  "DACT2" : L8ACT2,
  "DACT3" : L8ACT3,
  "DPRED" : L8DPRED,
  "DP1" : L8DP1,
  "DP2" : L8DP2,
  "DP3" : L8DP3,
  "DP4" : L8DP4,
  "DPRE" : L8DPRE,
  "DPRO" : L8PRO,
  "DLIM" : L8LIMITATIONS,
  "GEN" : L8GEN,
  "MED" : L8MEDCOM,
  "STP" : L8STP1,
  }

  const L9decision ={
    "DACT1" : L9ACT1,
  "DACT2" : L9ACT2,
  "DACT3" : L9ACT3,
  "DPRED" : L9DPRED,
  "DP1" : L9DP1,
  "DP2" : L9DP2,
  "DP3" : L9DP3,
  "DP4" : L9DP4,
  "DPRE" : L9DPRE,
  "DPRO" : L9PRO,
  "DLIM" : L9LIMITATIONS,
  "GEN" : L9GEN,
  "MED" : L9MEDCOM,
  "STP" : L9STP1,
  }

  const L10decision ={
    "DACT1" : L10ACT1,
  "DACT2" : L10ACT2,
  "DACT3" : L10ACT3,
  "DPRED" : L10DPRED,
  "DP1" : L10DP1,
  "DP2" : L10DP2,
  "DP3" : L10DP3,
  "DP4" : L10DP4,
  "DPRE" : L10DPRE,
  "DPRO" : L10PRO,
  "DLIM" : L10LIMITATIONS,
  "GEN" : L10GEN,
  "MED" : L10MEDCOM,
  "STP" : L10STP1,
  }

  const L11decision ={
    "DACT1" : L11ACT1,
  "DACT2" : L11ACT2,
  "DACT3" : L11ACT3,
  "DPRED" : L11DPRED,
  "DP1" : L11DP1,
  "DP2" : L11DP2,
  "DP3" : L11DP3,
  "DP4" : L11DP4,
  "DPRE" : L11DPRE,
  "DPRO" : L11PRO,
  "DLIM" : L11LIMITATIONS,
  "GEN" : L11GEN,
  "MED" : L11MEDCOM,
  "STP" : L11STP1,
  }

  const L12decision ={
    "DACT1" : L12ACT1,
  "DACT2" : L12ACT2,
  "DACT3" : L12ACT3,
  "DPRED" : L12DPRED,
  "DP1" : L12DP1,
  "DP2" : L12DP2,
  "DP3" : L12DP3,
  "DP4" : L12DP4,
  "DPRE" : L12DPRE,
  "DPRO" : L12PRO,
  "DLIM" : L12LIMITATIONS,
  "GEN" : L12GEN,
  "MED" : L12MEDCOM,
  "STP" : L12STP1,
  }

  const M1decision ={
    "DACT1" : M1ACT1,
  "DACT2" : M1ACT2,
  "DACT3" : M1ACT3,
  "DPRED" : M1DPRED,
  "DP1" : M1DP1,
  "DP2" : M1DP2,
  "DP3" : M1DP3,
  "DP4" : M1DP4,
  "DPRE" : M1DPRE,
  "DPRO" : M1PRO,
  "DLIM" : M1LIMITATIONS,
  "GEN" : M1GEN,
  "MED" : M1MEDCOM,
  "STP" : M1STP1,
  }

  const M2decision ={
    "DACT1" : M2ACT1,
  "DACT2" : M2ACT2,
  "DACT3" : M2ACT3,
  "DPRED" : M2DPRED,
  "DP1" : M2DP1,
  "DP2" : M2DP2,
  "DP3" : M2DP3,
  "DP4" : M2DP4,
  "DPRE" : M2DPRE,
  "DPRO" : M2PRO,
  "DLIM" : M2LIMITATIONS,
  "GEN" : M2GEN,
  "MED" : M2MEDCOM,
  "STP" : M2STP1,
  }


//anchor
const link1 ={
  "A-1" : A1decision,
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
  "C-1" : C1decision,
  "C-2" : C2decision,
  "C-3" : C3decision,
  "C-4" : C4decision,
  "C-5" : C5decision,
  "C-6" : C6decision,
  "C-7" : C7decision,
  "D-1" : D1decision,
  "D-2" : D2decision,
  "E-1" : E1decision,
  "E-2" : E2decision,
  "E-3" : E3decision,
  "E-4" : E4decision,
  "F-1" : F1decision,
  "F-2" : F2decision,
  "F-3" : F3decision,
  "F-4" : F4decision,
  "F-5" : F5decision,
  "F-6" : F6decision,
  "G-1" : G1decision,
  "G-2" : G2decision,
  "H-1" : H1decision,
  "H-2" : H2decision,
  "H-3" : H3decision,
  "H-4" : H4decision,
  "I-1" : I1decision,
  "I-2" : I2decision,
  "I-3" : I3decision,
  "I-4" : I4decision,
  "I-5" : I5decision,
  "I-6" : I6decision,
  "J-1" : J1decision,
  "J-2" : J2decision,
  "J-3" : J3decision,
  "J-4" : J4decision,
  "J-5" : J5decision,
  "J-6" : J6decision,
  "J-7" : J7decision,
  "J-8" : J8decision,
  "J-9" : J9decision,
  "J-10" : J10decision,
  "J-11" : J11decision,
  "J-12" : J12decision,
  "J-13" : J13decision,
  "J-14" : J14decision,
  "J-15" : J15decision,
  "J-16" : J16decision,
  "J-17" : J17decision,
  "J-18" : J18decision,
  "K-1" : K1decision,
  "K-2" : K2decision,
  "K-3" : K3decision,
  "K-4" : K4decision,
  "K-5" : K5decision,
  "K-6" : K6decision,
  "K-7" : K7decision,
  "L-1" : L1decision,
  "L-2" : L2decision,
  "L-3" : L3decision,
  "L-4" : L4decision,
  "L-5" : L5decision,
  "L-6" : L6decision,
  "L-7" : L7decision,
  "L-8" : L8decision,
  "L-9" : L9decision,
  "L-10" : L10decision,
  "L-11" : L11decision,
  "L-12" : L12decision,
  "M-1" : M1decision,
  "M-2" : M2decision 
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
        greenbtn.classList.remove("closed")
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
    banner.innerHTML = currentSwitch.innerText;
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
    homecatbox.scrolltop = 0;
    banner.classList.remove("open");
    homebanner.classList.remove("closed");
    rtn.classList.toggle("closed");
  }
  if(Acontainer.classList.contains("open")){
    Acontainer.classList.remove("open");
    icon.classList.remove("open");
    info.classList.remove("open");
    greenbtn.classList.remove("closed");
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
    const e = document.querySelectorAll(".slider");
      e.forEach(function(currentGreen){
        const style = document.documentElement.style.getPropertyValue('--BGorigin');
        console.log(style)
        currentGreen.style.backgroundColor = style;
      })
  }
});

const greenbtn = document.querySelector(".green-btn");

//open ADTMC sheets from the subtext buttons
const ADTsheets = document.querySelectorAll(".ADTsheet");
const ADTMCpagers = document.querySelectorAll(".subtexts");
ADTMCpagers.forEach(function(currentPager){
currentPager.addEventListener('click',()=> { 
  console.log(currentPager.id)
  const border = currentPager.querySelector(".subtext-border");
  const bLabel = document.querySelector("#banner3-label");
  const clearbtn = document.querySelector("#green-just-btn")
  complaints.classList.add('paged');
  Acontainer.classList.toggle('open');
  banner.classList.add("closed");
  subbanner.classList.add("open");
  bLabel.innerHTML = currentPager.innerText;
  const sheetnow = ADTMCSheets[currentPager.id];
  sheetnow.classList.add("open");
  Acontainer.scrollTop = 0;
  ADTpage.scrollTop = 0;
  const style = getComputedStyle(border);
  const color1 = style.backgroundColor
  const style2 = getComputedStyle(border);
  const color2 = style2.color;
  console.log(color1)
  console.log(color2)
  const sheetborder = document.querySelector(".ADT-border");
  sheetborder.style.backgroundColor = color1;
  clearbtn.style.backgroundColor = color1;
  clearbtn.style.color = color2;
  
});
});
//all ADTsheet toggles
function DC(){
  var btnid = event.target.id;
  var btn = document.getElementById(btnid);
  var dad = btn.closest(".ADTsheet");
  var box = btn.closest(".Qbox");
  var dispo = box.querySelector(".dispobox");
  var just = box.querySelector(".justbox");
  if(just.classList.contains("open")){just.classList.toggle("open")}
  if(btn.checked){
      let a = btn.parentElement;
      let b = a.parentElement;
      let c = b.parentElement;
      let border = document.querySelector(".ADT-border");
      let e = c.querySelector(".slider");
      console.log(border)
      const style = getComputedStyle(border);
      const color = style.backgroundColor
      console.log(color);
      e.style.backgroundColor = color;
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
      let e = c.querySelector(".slider");
      const style = document.documentElement.style.getPropertyValue('--BGorigin');
      console.log(style)
      e.style.backgroundColor = style;
      d.innerHTML = "NO";
      if(dispo.classList.contains("open")){dispo.classList.toggle("open")};
      functions[dad.id]();
  };
  };

//greenbtn to run justify:[]


//My special princess button in A-2/A-4 that just toggles more questions
function DC2(){
  var btnid = event.target.id;
  var btn = document.getElementById(btnid);
  var dad = btn.closest(".ADTsheet");
  var box = btn.closest(".Qbox");
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
  const bg2 = document.querySelector(".bod2");
  const bg = document.querySelector(".bod1");
  const medbtn = document.querySelector("#medbtn");
  const settings = document.querySelector(".settings-btn")
  // medbtn.addEventListener("click",()=>{

  //   medi.classList.toggle("show");
  //   bg.classList.toggle("BG101");
  //   bg2.classList.toggle("open");
    
  // });

  $(function() {
    var $toggleMenu = $("#medbtn"),
        $menu = $(".bod2"),
        $bod3 = $(".bod3"),
        $background1 =$(".bod1");
    $toggleMenu.on("click", function(e) {
      e.preventDefault();
      toggleUserMenu();
    });
    $toggleMenu.on("mouseup", function(e) {
      e.stopPropagation();
    });
    var hideMenu = function() {
        $menu.removeClass("open"),
        $background1.removeClass("BG101"),
        $toggleMenu.removeClass("show");
        $(document).off("mouseup", mouseupHandler);
    };
    var mouseupHandler = function (e) {
        if (!$menu.is(e.target) && $menu.has(e.target).length === 0) {
          hideMenu();
        }
    };  
    function toggleUserMenu() {
      var menuIsVisible = $menu.hasClass(".open");
      if (menuIsVisible) {
        hideMenu();
      } else {
        $menu.show();
        $(document).on("mouseup", mouseupHandler);
      }
    }
  });

function openlog(){
  document.querySelector(".toastwrapper").classList.toggle("selected");
}


  //toggle explanation box
function explain(){
  var btn = event.target;
  var a = btn.parentElement;
  var b = a.parentElement;
  var c = b.querySelector(".justbox");
  c.classList.toggle("open");
  // const Acont = document.querySelector(".ADTcontainer");
  // if(document.querySelector(".toastwrapper").classList.contains("selected")){Acont.setAttribute('style', 'opacity: 1;');}else{  Acont.setAttribute('style', 'opacity: 0.2;');}

}

const icon = document.querySelector("#btni")
const info = document.querySelector(".infobox");
const medi = document.querySelector("#medbtn");
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
const C1ddxs = ["Medication","Infection","Intense Pain","Pregnancy","Concussion","Heartburn"];
const C2ddxs = ["Food Intolerance", "Medication", "Infection (Viral/Bacterial)", "Dizziness", "Chest Pain", "Ear Pain", "Heartburn"];
const C3ddxs = ["MI, AAA","Appendicitis","Pancreatitis, Hepatitis","Heartburn","Ectopic Pregnancy","Testicular Torsion","Pelvic Inflammatory Dis."];
const C4ddxs = ["Gastrointestinal Bleed","Hemorrhoid/Fissure","IBD","Infection","Cancer"];
const C5ddxs = ["Obstruction","Cancer","Hypothyroidism","Constipation","Associated with Hemorrhoids"];
const C6ddxs = ["Food bolus obstruction","Esophagitis","Ring, Web, Achalasia","Throat Infection"];
const C7ddxs = ["Gastroesophageal Reflux","Myocardial Infarction","Stomach/Duodenal Ulcer","Cancer","Pancreatitis"];
const D1ddxs = ["Asthma","Anxiety","Myocardial Infarction","Pulmonary Embolism","Pneumonia, Bronchitis","Deconditioning"];
const D2ddxs = ["Myocardial Infarction","Pulmonary Embolism","Pneumonia, Bronchitis","Anxiety","Heartburn","Musculoskeletal"];
const E1ddxs = ["Kidney Infection","Urinary Tract Infection","Kidney Stone","Uncontrolled Diabetes","BPH","STI, Vaginitis"];
const E2ddxs = ["Testicular Torsion","Hernia","Muscle/Tendon Strain","Stress Fracture","Hip injury"];
const E3ddxs = ["Testicular Torsion","Hernia","Muscle/Tendon Strain","Stress Fracture","Hip injury"];
const E4ddxs = ["Urinary Obstruction","Benign Prostatic Hypertrophy","UTI, STI","Stress Incontinence"];
const F1ddxs = ["Orthostatic Hypotension","Vasovagal Syncope","Vertigo","Anxiety","Heart Arrhythmia","Intracranial Bleed","Seizure, Drugs, Alcohol"];
const F2ddxs = ["Migraine Headache","Tension Headache","Caffeine Withdrawal","Infection/Meningitis","Intracranial Hemorrhage"];
const F3ddxs = ["Viral Syndrome/ Fatigue","Stroke","Nerve Compression","Hypoglycemia","Hyperventilation","Depression","Lyme disease"];
const F4ddxs = ["Hypoglycemia","Hypotension","Hypoxia","Concussion","Infection","Intoxication"];
const F5ddxs = ["Depression","Anxiety","Hypoxia","Hypo/hyperthyroidism","Substance intoxication or withdrawal"];
const F6ddxs = ["Headache/migraine","Concussion","Intracerebral Hemorrhage","Anxiety","Stroke","Spinal cord injury","Seizure","Dehydration"];
const G1ddxs = ["Sleep Debt","Sleep Apnea","Anemia","Anxiety Disorders","Chronic Infection/Inflammation","Chronic fatigue syndrome","Acute liver failure"];
const G2ddxs = ["Malaise","Cold Symptoms","Sore Throat, Ear Pain","Heat/Cold Injury","Diarrhea","Pain with urination"];
const H1ddxs = ["Blepharitis","Allergies","Conjunctivitis","Corneal Abrasion/Trauma","Subconjunctival Hemorrhage","Keratitis/Iritis"];
const H2ddxs = ["Stye, Blepharitis","Dermatitis","Infection","Eyelid laceration"];
const H3ddxs = ["Trauma","Migraine","Hemorrhage","Infection","Ischemia, Stroke"];
const H4ddxs = ["Intoxication","Prescription Eyeglasses","Muscle Weakness","Trauma"];
const I1ddxs = ["Cyclical Breast Pain","Musculoskeletal Issue","Large Breasts","Mastitis, Abscess","Cancer"];
const I2ddxs = ["Irregular Menstrual Cycle","Pregnancy"];
const I3ddxs = ["Heavy Menstrual Cycle","Irregular Menstrual Cycle","Birth Control Side Effect","Miscarriage","Ectopic Pregnancy"];
const I4ddxs = ["Bacterial Vaginosis","Yeast Infection","Trichomonas","Pelvic Inflammatory Disease","STI"];
const I5ddxs = ["N/A"];
const I6ddxs = ["N/A"];
const J1ddxs = ["Eczema","Hives","Contact Dermatitis","Athlete’s Foot","Heat Rash","Drug Reaction"];
const J2ddxs = ["Acne Vulgaris","Pseudofolliculitis Barbae","Folliculitis","Acne Rosacea","Hyperandrogenism"];
const J3ddxs = ["Acne","Pseudofolliculitis Barbae","Folliculitis","Tinea Barbae","Acne Keloidalis Nuchae"];
const J4ddxs = ["Pemphigus Foliaceous","Tinea Capitis","Psoriasis","Allergic Contact Dermatitis","Seborrheic Dermatitis"];
const J5ddxs = ["Alopecia","Traction Hair Loss","Alopecia Areata","Tinea Capitis","Acne Keloidalis Nuchae"];
const J6ddxs = ["Interdigital tinea pedis","Hyperkeratotic (moccasin-type) tinea pedis","Vesiculobullous (Inflammatory) tinea pedis"];
const J7ddxs = ["Inverse psoriasis","Erythrasma","Seborrheic dermatitis","Candidal intertrigo"];
const J8ddxs = ["Seborrheic dermatitis","Tinea corporis","Vitiligo","Secondary syphilis"];
const J9ddxs = ["Folliculitis","Abscess","Epidermal Cyst","Hidradenitis Suppurativa","Septic Joint"];
const J10ddxs = ["Cold Sore","Aphthous Ulcer","Epstein-Barr Virus","Syphilis"];
const J11ddxs = ["Abrasion","Laceration"];
const J12ddxs = ["N/A"];
const J13ddxs = ["Hives","Contact Dermatitis","Viral Exanthem","Drug Rash"];
const J14ddxs = ["Burn","Irritant Contact Dermatitis"];
const J15ddxs = ["Corn","Stephen Johnson Syndrome","Staphylococcal scalded skin syndrome"];
const J16ddxs = ["Callus","Plantar Wart","Corn","Bunion"];
const J17ddxs = ["Cutaneous Wart","Corn","Callous","Skin Cancer"];
const J18ddxs = ["Paronychia","Ingrown Toenail","Trauma","Cellulitis"];
const K1ddxs = ["Heatstroke","Heat Cramps","Heat Exhaustion","Fever/ Infection","Dehydration","Hyperthyroidism"];
const K2ddxs = ["Environmental Exposure","Exhaustion and Malnutrition","Hypothyroidism","Sepsis"];
const K3ddxs = ["Nonfreezing Cold Injury","Cold Urticaria","Raynaud Phenomenon","Frostbite"];
const K4ddxs = ["N/A"];
const K5ddxs = ["N/A"];
const K6ddxs = ["Lice","Scabies","Contact Dermatitis","Fungal Infection","Hair Casts"];
const K7ddxs = ["Insect Bite","Skin Infection","Contact Dermatitis"];
const L1ddxs = ["Low Risk Exposure","High Risk Exposure"];
const L2ddxs = ["Tooth Cavity","Poor Dental Hygiene","Temporomandibular Joint Pain","Infection","Heart Attack"];
const L3ddxs = ["Aphthous Ulcers","Herpes Simplex Virus","Hand, Foot, and Mouth Disease","Stevens Johnson Syndrome"];
const L4ddxs = ["N/A"];
const L5ddxs = ["N/A"];
const L6ddxs = ["N/A"];
const L7ddxs = ["N/A"];
const L8ddxs = ["N/A"];
const L9ddxs = ["N/A"];
const L10ddxs = ["N/A"];
const L11ddxs = ["N/A"];
const L12ddxs = ["N/A"];
const M1ddxs = ["N/A"];
const M2ddxs = ["N/A"];
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
const C1flags = ["Vomiting Blood or Coffee Grinds, Melena","Neurologic Symptoms","Chest Pain","Abdominal Pain followed by Nausea","Abdominal Distension"];
const C2flags = ["Vomiting Blood or Coffee Grinds, Melena ","Severe abdominal pain"," Significant weight loss"];
const C3flags = ["Abnormal Vitals","Abdominal rigidity/rebound (bump chair)","Severe pain","Fever with jaundice and RUQ pain","Confirmed Pregnancy","Alcoholism","Immunocompromised","RLQ Pain"];
const C4flags = ["Toilette FULL of Blood","Vomiting Blood or Coffee Grinds","Melena","Lightheaded"];
const C5flags = ["Diarrhea at night","Iron deficiency anemia","Vomiting"];
const C6flags = ["Airway compromise","Coughing, choking when swallowing"];
const C7flags = ["Vomiting Blood or Coffee Grinds","Melena","Angina", "SOB","Radiation to Back"];
const D1flags = ["Cyanosis","Ancillary muscles","SpO2<90%","SIRS Criteria","Airway Swelling","Hives","Altered Mental Status (AMS)"];
const D2flags = ["Irregular Pulse","H/O or FH of Heart Problems","Shoulder, jaw pain or pressure"];
const E1flags = ["Systemic Inflammatory Response Syndrome","Flank Pain","Severe Abdominal Pain","Gross Hematuria or Passing Blood Clots"];
const E2flags = ["Pain with testes supported","Suspect Stress Fracture (increased with weight bearing or during exercise, endurance training, change in exercise routine)","Severe Pain"];
const E3flags = ["Female Pelvic Pain with Intercourse","Pregnant","Orthostatic, Fever"];
const E4flags = ["Inability to void x 12 hours","Fever","Cola Colored Urine","Blood or Clots in Urine"];
const F1flags = ["Abnormal Vital Signs","Irregular Pulse","Witnessed or H/O Seizure","Severe Headache","Heat Injury"];
const F2flags = ["Sudden Onset, Severe","Focal Neurologic Signs","Blown pupil","Severe Hypertension","Fever","Vision Change/Loss"];
const F3flags = ["Localized to a Region or 1 sided","Recent Trauma","Loss of Consciousness","Bowel/Bladder Incontinence"];
const F4flags = ["Abnormal Vital Signs","Altered Mental Status","Focal Neurological Deficit","Recent Trauma"];
const F5flags = ["Homicidal Intent or Attempt","Suicide Intent or Attempt","Self-injury","Altered Mental Status"];
const F6flags = ["Deteriorating Level of Consciousness","Double Vision","Increased Restlessness, combative or agitated behavior","Repeat vomiting","Positive result from structural brain injury detection device (if available)","Seizure","Weakness or tingling in arms or legs","Devere or worsening headache","Abnormal Neuro Exam","Battle sign, Raccoon eyes","Suspected skull fracture","Anticoagulant use"];
const G1flags = ["Suicide Ideation","Homicide Ideation","Shortness of Breath","Stiff Neck","Melena"];
const G2flags = ["Heat Injury","Stiff Neck","Light sensitivity","Pregnant","Seizure","Lightheaded"];
const H1flags = ["Fixed, Abnormal Pupil"," Visual Acuity Change"," Observed Foreign Body"," Penetration, Rupture"," Chemical Exposure"," Fluid Level over Iris, Pupil"];
const H2flags = ["Open Globe"," High Risk Laceration"," Decreased Visual Acuity"," Double Vision"];
const H3flags = ["Trauma"," Recent Surgery"," Chemical Exposure"," Fluid Level over Iris, Pupil"," Neurologic Deficits"];
const H4flags = ["Trauma"," Neurologic Deficits"];
const I1flags = ["Skin Changes"," Mass"," Bloody Nipple Discharge"];
const I2flags = ["Positive hCG AND"," Pelvic Pain"," H/O Ectopic Pregnancy"," Vaginal Bleeding"];
const I3flags = ["Sexual Assault"," Trauma"," Severe Pain"," Pregnant"];
const I4flags = ["Fever"," Pregnant"," Non-midline Pelvic Pain","Pain with Intercourse"];
const I5flags = ["N/A"];
const I6flags = ["N/A"];
const J1flags = ["Airway Compromise/Swelling"];
const J2flags = ["N/A"];
const J3flags = ["Facial Cellulitis"];
const J4flags = ["Scaling with Visible Inflammation"," Abnormal Sensation"," Painful Erosions"];
const J5flags = ["N/A"];
const J6flags = ["Diabetic Soldiers","Significant erosions/ulcerations or malodor in affected area","Soldiers w/weakened immune systems"];
const J7flags = ["Diabetes"," Immunodeficiency"];
const J8flags = ["N/A"];
const J9flags = ["Location over Tailbone"," SIRS Criteria"," Worsening on Antibiotics"," Palm of Hand"," Over Joint"," Black Eschar"];
const J10flags = ["Eye Pain"];
const J11flags = ["SIRS Criteria"," Animal Bite, Scratch"];
const J12flags = ["Fever"," Pus/redness/swelling"];
const J13flags = ["Airway Swelling"," Wheezing"," Anaphylaxis"];
const J14flags = ["Trouble Breathing"," AMS, Drowsy"," High Risk Location"," Circumferential Burn"];
const J15flags = ["Fever/malaise"," Epidermal sloughing"];
const J16flags = ["N/A"];
const J17flags = ["N/A"];
const J18flags = ["Red Streaks up Foot"," Gangrene"," Black Eschar"];
const K1flags = ["Altered mental status"," Abnormal vital signs"];
const K2flags = ["T<96 degrees F"," Altered Mental Status"," Abnormal Vital Signs"," Frostbite"," Trauma"];
const K3flags = ["Gangrene/Necrosis"," Hemorrhagic Blisters"," Hypothermia"," Frostbite"," Trauma"];
const K4flags = ["N/A"];
const K5flags = ["N/A"];
const K6flags = ["N/A"];
const K7flags = ["Swelling of Lips or Tongue","Trouble Breathing","Abnormal Vital Signs"];
const L1flags = ["Known Infection"," High Risk Contact"];
const L2flags = ["Exposed Pulp"," Avulsed Tooth"," Severe Pain"," Trauma"," Chest Pain, SOB"];
const L3flags = ["Diffuse"," Bloody Diarrhea"];
const L4flags = ["N/A"];
const L5flags = ["N/A"];
const L6flags = ["N/A"];
const L7flags = ["N/A"];
const L8flags = ["N/A","1"];
const L9flags = ["N/A"];
const L10flags = ["N/A"];
const L11flags = ["N/A"];
const L12flags = ["N/A"];
const M1flags = ["N/A"];
const M2flags = ["N/A"];



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
//Green button to show cat III at the beginning of screening
function c3it(){
  const a = event.target;
  console.log(a)
  const b = document.querySelector(".ADTsheet.open");
  console.log(b)
  document.querySelector(".green-btn").classList.toggle("closed");
  functions[b.id]();

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
      console.log("ddx works")
      ul.appendChild(li);
  }
  //append red flags with cont2
    for (i = 0; i <= redflagvalue.length - 1; i++) {
      var li2 = document.createElement('li');
      li2.innerHTML = redflagvalue[i];
      li2.setAttribute('style', 'display: block;');
      ul2.appendChild(li2);
      console.log("red f works")
  }
 //append ddx and red flag li to their ul after validation
  cont.appendChild(ul);
  cont2.appendChild(ul2);

});
});
//anchor justify
//functions to link the id to the of the ADTSheet to how the disposition boxes pop up
const functions = {
  "A-1" : justifyA1,
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
  "C-1" : justifyC1,
  "C-2" : justifyC2,
  "C-3" : justifyC3,
  "C-4" : justifyC4,
  "C-5" : justifyC5,
  "C-6" : justifyC6,
  "C-7" : justifyC7,
  "D-1" : justifyD1,
  "D-2" : justifyD2,
  "E-1" : justifyE1,
  "E-2" : justifyE2,
  "E-3" : justifyE3,
  "E-4" : justifyE4,
  "F-1" : justifyF1,
  // "F-2" : justifyF2,
  "F-3" : justifyF3,
  "F-4" : justifyF4,
  "F-5" : justifyF5,
  "F-6" : justifyF6,
  "G-1" : justifyG1,
  "G-2" : justifyG2,
  "H-1" : justifyH1,
  "H-2" : justifyH2,
  "H-3" : justifyH3,
  "H-4" : justifyH4,
  "I-1" : justifyI1,
  "I-2" : justifyI2,
  "I-3" : justifyI3,
  "I-4" : justifyI4,
  "I-5" : justifyI5,
  "I-6" : justifyI6,
  "J-1" : justifyJ1,
  "J-2" : justifyJ2,
  "J-3" : justifyJ3,
  "J-4" : justifyJ4,
  "J-5" : justifyJ5,
  "J-6" : justifyJ6,
  "J-7" : justifyJ7,
  "J-8" : justifyJ8,
  "J-9" : justifyJ9,
  "J-10" : justifyJ10,
  "J-11" : justifyJ11,
  "J-12" : justifyJ12,
  "J-13" : justifyJ13,
  "J-14" : justifyJ14,
  "J-15" : justifyJ15,
  "J-16" : justifyJ16,
  "J-17" : justifyJ17,
  "J-18" : justifyJ18,
  "K-1" : justifyK1,
  "K-2" : justifyK2,
  "K-3" : justifyK3,
  "K-4" : justifyK4,
  "K-5" : justifyK5,
  "K-6" : justifyK6,
  "K-7" : justifyK7,
  "L-1" : justifyL1,
  "L-2" : justifyL2,
  "L-3" : justifyL3,
  "L-4" : justifyL4,
  "L-5" : justifyL5,
  "L-6" : justifyL6,
  "L-7" : justifyL7,
  "L-8" : justifyL8,
  "L-9" : justifyL9,
  "L-10" : justifyL10,
  "L-11" : justifyL11,
  "L-12" : justifyL12,
  "M-1" : justifyM1,
  "M-2" : justifyM2 


}

//individual justification scripts for each. called when the toggle button is switched
function justifyA1() {
  var btnid = event.target.id;
  console.log(btnid);
  const hidden = A1.querySelector(".subQ");
  const A1red = A1.querySelector("#A1-redbtn");
  const A1c1 = A1.querySelector("#A1-1-btn");
  const A1c2 = A1.querySelector("#A1-2-btn");
  const A1c3 = A1.querySelector("#A1-3-btn");
  const A1c4 = A1.querySelector("#A1-4-btn");
  const A1c5 = A1.querySelector("#A1-5-btn");
  const dispored = A1.querySelector("#A1dispo-red");
  const dispo2 = A1.querySelector("#A1dispo-2");
  const dispo3 = A1.querySelector("#A1dispo-3");
  const dispo4 = A1.querySelector("#A1dispo-4");
  const dispoRETEST = A1.querySelector("#A1dispo-RETEST");
  const dispoRTD = A1.querySelector("#A1dispo-RTD");
  if(A1c1.checked == true){
    if(!hidden.classList.contains("selected")){hidden.classList.toggle("selected")}
  }else{hidden.classList.remove("selected")}
  if(A1red.checked == true){
    console.log("it works");
    A1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
  }else{
      if(A1c2.checked == true){
        A1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispo2.classList.contains("open")){dispo2.classList.toggle("open"); greenbtn.classList.add("closed")}
      }else{
        if(A1c3.checked == true){
            A1.querySelectorAll('.dispobox').forEach(el => {
              el.classList.remove('open')});
              if(!dispo3.classList.contains("open")){dispo3.classList.toggle("open"); greenbtn.classList.add("closed")}
          }else{
        A1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(A1c4.checked == true){
            A1.querySelectorAll('.dispobox').forEach(el => {
              el.classList.remove('open')});
              if(!dispo4.classList.contains("open")){dispo4.classList.toggle("open"); greenbtn.classList.add("closed")}
          }else{
            A1.querySelectorAll('.dispobox').forEach(el => {
              el.classList.remove('open')});
              if(A1c5.checked == true){
                A1.querySelectorAll('.dispobox').forEach(el => {
                  el.classList.remove('open')});
                  if(!dispoRETEST.classList.contains("open")){dispoRETEST.classList.toggle("open"); greenbtn.classList.add("closed")}
              }else{
                if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}}
          }
          }
        }
      }
    }

    const cent5 = document.querySelector("#cent5");
    const criteria = document.querySelectorAll(".centor-crit");
    const countbox = document.querySelector(".countcenter")
    criteria.forEach(function(currentSwitch){
        currentSwitch.addEventListener('click',()=> {
                cent5.classList.remove("centsel");
                currentSwitch.classList.toggle("centsel")
                centorCheck()
            })
    
        })
    cent5.addEventListener('click',()=> {
        document.querySelectorAll('.centsel').forEach(el => {
            el.classList.remove('centsel');
          })
        cent5.classList.toggle("centsel")
        centorCheck();
    });
    
    function centorCheck(){
        let count = document.querySelectorAll(".centor-crit.centsel").length
        if(cent5.classList.contains("centsel")){
            count = 0
        }
        console.log(count)
        if(count == 0 && !cent5.classList.contains("centsel")){
            cent5.classList.toggle("centsel")
        }
        countbox.innerText = count
        if(count >=3 && !document.querySelector(".subQ").classList.contains("selected")){
            document.querySelector(".subQ").classList.toggle("selected");
        }
        if(count <= 2){
            document.querySelector(".subQ").classList.remove("selected");
        }
    }

function justifyA1() {
  const A1red = A1.querySelector("#A1-redbtn");
  const A1A1 = A1.querySelector("#A1-2-btn");
  const A1c2 = A1.querySelector("#A1-3-btn");
  const dispored = A1.querySelector("#A1dispo-red");
  const dispo1 = A1.querySelector("#A1dispo-2");
  const dispoRETEST = A1.querySelector("#A1dispo-RETEST");
  const dispoRTD = A1.querySelector("#A1dispo-RTD");
  if(A1red.checked == true){
      console.log("it works");
      A1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')}); 
        if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
  }else{
      A1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(A1A1.checked == true){
        A1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")}
  
      }else{
        if(A1c2.checked == true){
          A1.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispoRETEST.classList.contains("open")){dispoRETEST.classList.toggle("open"); greenbtn.classList.add("closed")}
        }else{
          A1.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
            }
          }
        }
      }


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
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
  }else{
      if(A2c2.checked == true){
        A2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispo2.classList.contains("open")){dispo2.classList.toggle("open"); greenbtn.classList.add("closed")}
      }else{
        if(A2c3.checked == true){
            A2.querySelectorAll('.dispobox').forEach(el => {
              el.classList.remove('open')});
              if(!dispo3.classList.contains("open")){dispo3.classList.toggle("open"); greenbtn.classList.add("closed")}
          }else{
        A2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(A2c4.checked == true){
            A2.querySelectorAll('.dispobox').forEach(el => {
              el.classList.remove('open')});
              if(!dispo4.classList.contains("open")){dispo4.classList.toggle("open"); greenbtn.classList.add("closed")}
          }else{
            A2.querySelectorAll('.dispobox').forEach(el => {
              el.classList.remove('open')});
              if(A2c5.checked == true){
                A2.querySelectorAll('.dispobox').forEach(el => {
                  el.classList.remove('open')});
                  if(!dispoRETEST.classList.contains("open")){dispoRETEST.classList.toggle("open"); greenbtn.classList.add("closed")}
              }else{
                if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}}
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
      A3.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')}); 
      if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
  }else{
      A3.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(A3c1.checked == true){
        A3.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")}
  
      }else{
        if(A3c2.checked == true){
          A3.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispo2.classList.contains("open")){dispo2.classList.toggle("open"); greenbtn.classList.add("closed")}
        }else{
          A3.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
        }
      }
    }
  }
//Justification A4
  function justifyA4() {
    var btnid = event.target.id;
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
      if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
    }else{
        if(A4c1.checked == true){
          A4.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")}
        }else{
          if(A4c3.checked == true){
              A4.querySelectorAll('.dispobox').forEach(el => {
                el.classList.remove('open')});
                if(!dispo3.classList.contains("open")){dispo3.classList.toggle("open"); greenbtn.classList.add("closed")}
            }else{
          A4.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(A4c4.checked == true){
              A4.querySelectorAll('.dispobox').forEach(el => {
                el.classList.remove('open')});
                if(!dispoRETEST.classList.contains("open")){dispoRETEST.classList.toggle("open");}
            }else{
                  if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}}
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
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
  }else{
    A5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(A5c1.checked == true){
      A5.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
      A5.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(A5c2.checked == true){
        A5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo2.classList.contains("open")){dispo2.classList.toggle("open"); greenbtn.classList.add("closed")};

      }else{
        A5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(A5c3.checked == true){
          if(!dispoRETEST.classList.contains("open")){dispoRETEST.classList.toggle("open"); greenbtn.classList.add("closed")};

        }else{
        A5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
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
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
  }else{
    B1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(B1c1.checked == true){
      B1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        B1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
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
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
  }else{
    B2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(B2c1.checked == true){
      B2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        B2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
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
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
  }else{
    B3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(B3c1.checked == true){
      B3.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        B3.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
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
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
  }else{
    B4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(B4c1.checked == true){
      B4.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        B4.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
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
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
  }else{
    B5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(B5c1.checked == true){
      B5.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        B5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
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
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
  }else{
    B6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(B6c1.checked == true){
      B6.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        B6.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
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
  if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
}else{
  B7.querySelectorAll('.dispobox').forEach(el => {
    el.classList.remove('open')});
  if(B7c1.checked == true){
    B7.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

  }else{
      B7.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
        if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
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
  if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
}else{
  B8.querySelectorAll('.dispobox').forEach(el => {
    el.classList.remove('open')});
  if(B8c1.checked == true){
    B8.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

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
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
  }else{
    B9.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(B9c1.checked == true){
      B9.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

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
      if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
    }else{
      B10.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(B10c1.checked == true){
        B10.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};
  
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
  if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
}else{
  B11.querySelectorAll('.dispobox').forEach(el => {
    el.classList.remove('open')});
  if(B11c1.checked == true){
    B11.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

  }else{
      B11.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
        if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open")}
  }}
}
function justifyC1() {
  const C1red = C1.querySelector("#C1-redbtn");
  const C1c1 = C1.querySelector("#C1-1-btn");
  const C1c2 = C1.querySelector("#C1-2-btn");
  const dispored = C1.querySelector("#C1dispo-red");
  const dispo1 = C1.querySelector("#C1dispo-1");
  const dispo2 = C1.querySelector("#C1dispo-2");
  const dispoRETEST = C1.querySelector("#C1dispo-RETEST");
  const dispoRTD = C1.querySelector("#C1dispo-RTD");
  if(C1red.checked == true){
      console.log("it works");
      C1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')}); 
        if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
  }else{
      C1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(C1c1.checked == true){
        C1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")}
  
      }else{
        if(C1c2.checked == true){
          C1.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispoRETEST.classList.contains("open")){dispoRETEST.classList.toggle("open"); greenbtn.classList.add("closed")}
        }else{
          C1.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
            }
          }
        }
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
      if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
  }else{
      C2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(C2c1.checked == true){
        C2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")}
  
      }else{
        if(C2c2.checked == true){
          C2.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispo2.classList.contains("open")){dispo2.classList.toggle("open"); greenbtn.classList.add("closed")}
        }else{
          C2.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
            }
          }
        }
      }

function justifyC3() {
const C3red = C3.querySelector("#C3-redbtn");
const C3c1 = C3.querySelector("#C3-1-btn");
const C3c2 = C3.querySelector("#C3-2-btn");
const dispored = C3.querySelector("#C3dispo-red");
const dispo1 = C3.querySelector("#C3dispo-1");
const dispoRETEST = C3.querySelector("#C3dispo-RETEST");
const dispoRTD = C3.querySelector("#C3dispo-RTD");
if(C3red.checked == true){
    console.log("it works");
    C3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
}else{
    C3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(C3c1.checked == true){
      C3.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")}

    }else{
      if(C3c2.checked == true){
        C3.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRETEST.classList.contains("open")){dispoRETEST.classList.toggle("open"); greenbtn.classList.add("closed")}
      }else{
        C3.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
    }

function justifyC4() {
const C4red = C4.querySelector("#C4-redbtn");
const C4c1 = C4.querySelector("#C4-1-btn");
const dispored = C4.querySelector("#C4dispo-red");
const dispo1 = C4.querySelector("#C4dispo-1");
const dispoRTD = C4.querySelector("#C4dispo-RTD");
if(C4red.checked == true){
    console.log("it works");
    C4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
}else{
    C4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(C4c1.checked == true){
      C4.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")}

    }else{
        C4.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyC5() {
const C5red = C5.querySelector("#C5-redbtn");
const C5c1 = C5.querySelector("#C5-1-btn");
const dispored = C5.querySelector("#C5dispo-red");
const dispoRETEST = C5.querySelector("#C5dispo-RETEST");
const dispoRTD = C5.querySelector("#C5dispo-RTD");
if(C5red.checked == true){
    console.log("it works");
    C5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
}else{
    C5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(C5c1.checked == true){
      C5.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispoRETEST.classList.contains("open")){dispoRETEST.classList.toggle("open"); greenbtn.classList.add("closed")}

    }else{
        C5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyC6() {
const C6red = C6.querySelector("#C6-redbtn");
const C6c1 = C6.querySelector("#C6-1-btn");
const C6c2 = C6.querySelector("#C6-2-btn");
const dispored = C6.querySelector("#C6dispo-red");
const dispo1 = C6.querySelector("#C6dispo-1");
const dispoRETEST = C6.querySelector("#C6dispo-RETEST");
const dispoRTD = C6.querySelector("#C6dispo-RTD");
if(C6red.checked == true){
    console.log("it works");
    C6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
}else{
    C6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(C6c1.checked == true){
      C6.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")}

    }else{
      if(C6c2.checked == true){
        C6.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRETEST.classList.contains("open")){dispoRETEST.classList.toggle("open"); greenbtn.classList.add("closed")}
      }else{
        C6.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
    }
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
            if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
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
            if(!dispo3.classList.contains("open")&& greenbtn.classList.contains("closed")){dispo3.classList.toggle("open")}
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

function justifyE1() {
const E1red = E1.querySelector("#E1-redbtn");
const E1c1 = E1.querySelector("#E1-1-btn");
const dispored = E1.querySelector("#E1dispo-red");
const dispo1 = E1.querySelector("#E1dispo-1");
const dispoRTD = E1.querySelector("#E1dispo-RTD");
if(E1red.checked == true){
    console.log("it works");
    E1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
}else{
    E1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(E1c1.checked == true){
      E1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};

    }else{
        E1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyE2() {
const E2red = E2.querySelector("#E2-redbtn");
const E2c1 = E2.querySelector("#E2-1-btn");
const dispored = E2.querySelector("#E2dispo-red");
const dispo1 = E2.querySelector("#E2dispo-1");
const dispoRTD = E2.querySelector("#E2dispo-RTD");
if(E2red.checked == true){
    console.log("it works");
    E2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open"); greenbtn.classList.add("closed")}
}else{
    E2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(E2c1.checked == true){
      E2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        E2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyE3() {
const E3red = E3.querySelector("#E3-redbtn");
const E3c1 = E3.querySelector("#E3-1-btn");
const dispored = E3.querySelector("#E3dispo-red");
const dispo1 = E3.querySelector("#E3dispo-1");
const dispoRTD = E3.querySelector("#E3dispo-RTD");
if(E3red.checked == true){
    console.log("it works");
    E3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open")}
}else{
    E3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(E3c1.checked == true){
      E3.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open")};

    }else{
        E3.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyE4() {
const E4red = E4.querySelector("#E4-redbtn");
const E4c1 = E4.querySelector("#E4-1-btn");
const dispored = E4.querySelector("#E4dispo-red");
const dispo1 = E4.querySelector("#E4dispo-1");
const dispoRTD = E4.querySelector("#E4dispo-RTD");
const greenbtn = document.querySelector(".green-btn");
if(E4red.checked == true){
    console.log("it works");
    E4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    E4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(E4c1.checked == true){
      E4.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        E4.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyF1() {
const F1red = F1.querySelector("#F1-redbtn");
const F1c1 = F1.querySelector("#F1-1-btn");
const dispored = F1.querySelector("#F1dispo-red");
const dispo1 = F1.querySelector("#F1dispo-1");
const dispoRTD = F1.querySelector("#F1dispo-RTD");
if(F1red.checked == true){
    console.log("it works");
    F1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");
    greenbtn.classList.add("closed")}
}else{
    F1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(F1c1.checked == true){
      F1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        F1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyF3() {
const F3red = F3.querySelector("#F3-redbtn");
const F3c1 = F3.querySelector("#F3-1-btn");
const dispored = F3.querySelector("#F3dispo-red");
const dispo1 = F3.querySelector("#F3dispo-1");
const dispoRTD = F3.querySelector("#F3dispo-RTD");
if(F3red.checked == true){
    console.log("it works");
    F3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    F3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(F3c1.checked == true){
      F3.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        F3.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyF4() {
const F4red = F4.querySelector("#F4-redbtn");
const F4c1 = F4.querySelector("#F4-1-btn");
const dispored = F4.querySelector("#F4dispo-red");
const dispo1 = F4.querySelector("#F4dispo-1");
const dispoRTD = F4.querySelector("#F4dispo-RTD");
if(F4red.checked == true){
    console.log("it works");
    F4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    F4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(F4c1.checked == true){
      F4.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        F4.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyF4() {
const F4red = F4.querySelector("#F4-redbtn");
const F4c1 = F4.querySelector("#F4-1-btn");
const dispored = F4.querySelector("#F4dispo-red");
const dispo1 = F4.querySelector("#F4dispo-1");
const dispoRTD = F4.querySelector("#F4dispo-RTD");
if(F4red.checked == true){
    console.log("it works");
    F4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    F4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(F4c1.checked == true){
      F4.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        F4.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

    
function justifyF5() {
const F5red = F5.querySelector("#F5-redbtn");
const F5c1 = F5.querySelector("#F5-1-btn");
const dispored = F5.querySelector("#F5dispo-red");
const dispo1 = F5.querySelector("#F5dispo-1");
const dispoRTD = F5.querySelector("#F5dispo-RTD");
if(F5red.checked == true){
    console.log("it works");
    F5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    F5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(F5c1.checked == true){
      F5.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        F5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyF6() {
const F6red = F6.querySelector("#F6-redbtn");
const F6c1 = F6.querySelector("#F6-1-btn");
const dispored = F6.querySelector("#F6dispo-red");
const dispo1 = F6.querySelector("#F6dispo-1");
const dispoRTD = F6.querySelector("#F6dispo-RTD");
if(F6red.checked == true){
    console.log("it works");
    F6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    F6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(F6c1.checked == true){
      F6.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        F6.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyG1() {
const G1red = G1.querySelector("#G1-redbtn");
const G1c1 = G1.querySelector("#G1-1-btn");
const dispored = G1.querySelector("#G1dispo-red");
const dispo1 = G1.querySelector("#G1dispo-RETEST");
const dispoRTD = G1.querySelector("#G1dispo-RTD");
if(G1red.checked == true){
    console.log("it works");
    G1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    G1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(G1c1.checked == true){
      G1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        G1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }


function justifyG2() {
const G2red = G2.querySelector("#G2-redbtn");
const G2c1 = G2.querySelector("#G2-1-btn");
const dispored = G2.querySelector("#G2dispo-red");
const dispo1 = G2.querySelector("#G2dispo-RETEST");
const dispoRTD = G2.querySelector("#G2dispo-RTD");
if(G2red.checked == true){
    console.log("it works");
    G2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    G2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(G2c1.checked == true){
      G2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        G2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyH1() {
const H1red = H1.querySelector("#H1-redbtn");
const H1c1 = H1.querySelector("#H1-1-btn");
const dispored = H1.querySelector("#H1dispo-red");
const dispo1 = H1.querySelector("#H1dispo-1");
const dispoRTD = H1.querySelector("#H1dispo-RTD");
if(H1red.checked == true){
    console.log("it works");
    H1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    H1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(H1c1.checked == true){
      H1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        H1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyH4() {
const H4red = H4.querySelector("#H4-redbtn");
const H4c1 = H4.querySelector("#H4-1-btn");
const dispored = H4.querySelector("#H4dispo-red");
const dispo1 = H4.querySelector("#H4dispo-2");
const dispoRTD = H4.querySelector("#H4dispo-RTD");
if(H4red.checked == true){
    console.log("it works");
    H4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    H4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(H4c1.checked == true){
      H4.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        H4.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyH2() {
const H2red = H2.querySelector("#H2-redbtn");
const H2c1 = H2.querySelector("#H2-1-btn");
const dispored = H2.querySelector("#H2dispo-red");
const dispo1 = H2.querySelector("#H2dispo-2");
const dispoRTD = H2.querySelector("#H2dispo-RTD");
if(H2red.checked == true){
    console.log("it works");
    H2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    H2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(H2c1.checked == true){
      H2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        H2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }


function justifyH3() {
const H3red = H3.querySelector("#H3-redbtn");
const H3c1 = H3.querySelector("#H3-1-btn");
const dispored = H3.querySelector("#H3dispo-red");
const dispo1 = H3.querySelector("#H3dispo-2");
const dispoRTD = H3.querySelector("#H3dispo-RTD");
if(H3red.checked == true){
    console.log("it works");
    H3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    H3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(H3c1.checked == true){
      H3.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        H3.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyI1() {
const I1red = I1.querySelector("#I1-redbtn");
const I1c1 = I1.querySelector("#I1-1-btn");
const dispored = I1.querySelector("#I1dispo-red");
const dispo1 = I1.querySelector("#I1dispo-2");
const dispoRTD = I1.querySelector("#I1dispo-RTD");
if(I1red.checked == true){
    console.log("it works");
    I1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    I1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(I1c1.checked == true){
      I1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        I1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyI2() {
const I2red = I2.querySelector("#I2-redbtn");
const I2c1 = I2.querySelector("#I2-1-btn");
const dispored = I2.querySelector("#I2dispo-red");
const dispo1 = I2.querySelector("#I2dispo-2");
const dispoRTD = I2.querySelector("#I2dispo-RTD");
if(I2red.checked == true){
    console.log("it works");
    I2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    I2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(I2c1.checked == true){
      I2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        I2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyI3() {
const I3red = I3.querySelector("#I3-redbtn");
const I3c1 = I3.querySelector("#I3-1-btn");
const dispored = I3.querySelector("#I3dispo-red");
const dispo1 = I3.querySelector("#I3dispo-2");
const dispoRTD = I3.querySelector("#I3dispo-RTD");
if(I3red.checked == true){
    console.log("it works");
    I3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    I3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(I3c1.checked == true){
      I3.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        I3.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyI4() {
const I4red = I4.querySelector("#I4-redbtn");
const I4c1 = I4.querySelector("#I4-1-btn");
const dispored = I4.querySelector("#I4dispo-red");
const dispo1 = I4.querySelector("#I4dispo-2");
const dispoRTD = I4.querySelector("#I4dispo-RTD");
if(I4red.checked == true){
    console.log("it works");
    I4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    I4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(I4c1.checked == true){
      I4.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        I4.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyI5() {
const I5red = I5.querySelector("#I5-redbtn");
const I5c1 = I5.querySelector("#I5-1-btn");
const dispored = I5.querySelector("#I5dispo-red");
const dispo1 = I5.querySelector("#I5dispo-2");
const dispoRTD = I5.querySelector("#I5dispo-RTD");
if(I5red.checked == true){
    console.log("it works");
    I5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    I5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(I5c1.checked == true){
      I5.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        I5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyI6() {
const I6red = I6.querySelector("#I6-redbtn");
const I6c1 = I6.querySelector("#I6-1-btn");
const dispored = I6.querySelector("#I6dispo-red");
const dispo1 = I6.querySelector("#I6dispo-2");
const dispoRTD = I6.querySelector("#I6dispo-RTD");
if(I6red.checked == true){
    console.log("it works");
    I6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    I6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(I6c1.checked == true){
      I6.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispoRTD.classList.contains("open")){dispoRTD.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        I6.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyK1() {
  const K1red = K1.querySelector("#K1-redbtn");
  const K1c1 = K1.querySelector("#K1-1-btn");
  const dispored = K1.querySelector("#K1dispo-red");
  const dispo1 = K1.querySelector("#K1dispo-2");
  const dispoRTD = K1.querySelector("#K1dispo-RTD");
  if(K1red.checked == true){
      console.log("it works");
      K1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')}); 
      if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
  }else{
      K1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(K1c1.checked == true){
        K1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};
  
      }else{
          K1.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
            }
          }
        }

function justifyK2() {
const K2red = K2.querySelector("#K2-redbtn");
const K2c1 = K2.querySelector("#K2-1-btn");
const dispored = K2.querySelector("#K2dispo-red");
const dispo1 = K2.querySelector("#K2dispo-2");
const dispoRTD = K2.querySelector("#K2dispo-RTD");
if(K2red.checked == true){
    console.log("it works");
    K2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    K2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(K2c1.checked == true){
      K2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        K2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyK3() {
const K3red = K3.querySelector("#K3-redbtn");
const K3c1 = K3.querySelector("#K3-1-btn");
const dispored = K3.querySelector("#K3dispo-red");
const dispo1 = K3.querySelector("#K3dispo-2");
const dispoRTD = K3.querySelector("#K3dispo-RTD");
if(K3red.checked == true){
    console.log("it works");
    K3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    K3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(K3c1.checked == true){
      K3.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        K3.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyK4() {
const K4red = K4.querySelector("#K4-redbtn");
const K4c1 = K4.querySelector("#K4-1-btn");
const dispored = K4.querySelector("#K4dispo-red");
const dispo1 = K4.querySelector("#K4dispo-2");
const dispoRTD = K4.querySelector("#K4dispo-RTD");
if(K4red.checked == true){
    console.log("it works");
    K4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    K4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(K4c1.checked == true){
      K4.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        K4.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyK5() {
const K5red = K5.querySelector("#K5-redbtn");
const K5c1 = K5.querySelector("#K5-1-btn");
const dispored = K5.querySelector("#K5dispo-red");
const dispo1 = K5.querySelector("#K5dispo-2");
const dispoRTD = K5.querySelector("#K5dispo-RTD");
if(K5red.checked == true){
    console.log("it works");
    K5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    K5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(K5c1.checked == true){
      K5.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        K5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyK5() {
const K5red = K5.querySelector("#K5-redbtn");
const K5c1 = K5.querySelector("#K5-1-btn");
const dispored = K5.querySelector("#K5dispo-red");
const dispo1 = K5.querySelector("#K5dispo-2");
const dispoRTD = K5.querySelector("#K5dispo-RTD");
if(K5red.checked == true){
    console.log("it works");
    K5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    K5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(K5c1.checked == true){
      K5.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        K5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }

function justifyK6() {
const K6red = K6.querySelector("#K6-redbtn");
const K6c1 = K6.querySelector("#K6-1-btn");
const dispored = K6.querySelector("#K6dispo-red");
const dispo1 = K6.querySelector("#K6dispo-2");
const dispoRTD = K6.querySelector("#K6dispo-RTD");
if(K6red.checked == true){
    console.log("it works");
    K6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    K6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(K6c1.checked == true){
      K6.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        K6.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyK7() {
const K7red = K7.querySelector("#K7-redbtn");
const K7c1 = K7.querySelector("#K7-1-btn");
const dispored = K7.querySelector("#K7dispo-red");
const dispo1 = K7.querySelector("#K7dispo-2");
const dispoRTD = K7.querySelector("#K7dispo-RTD");
if(K7red.checked == true){
    console.log("it works");
    K7.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    K7.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(K7c1.checked == true){
      K7.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        K7.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyJ1() {
const J1red = J1.querySelector("#J1-redbtn");
const J1c1 = J1.querySelector("#J1-1-btn");
const dispored = J1.querySelector("#J1dispo-red");
const dispo1 = J1.querySelector("#J1dispo-2");
const dispoRTD = J1.querySelector("#J1dispo-RTD");
if(J1red.checked == true){
    console.log("it works");
    J1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J1c1.checked == true){
      J1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyJ2() {
const J2red = J2.querySelector("#J2-redbtn");
const J2c1 = J2.querySelector("#J2-1-btn");
const dispored = J2.querySelector("#J2dispo-red");
const dispo1 = J2.querySelector("#J2dispo-2");
const dispoRTD = J2.querySelector("#J2dispo-RTD");
if(J2red.checked == true){
    console.log("it works");
    J2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J2c1.checked == true){
      J2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }  
function justifyJ3() {
const J3red = J3.querySelector("#J3-redbtn");
const J3c1 = J3.querySelector("#J3-1-btn");
const dispored = J3.querySelector("#J3dispo-red");
const dispo1 = J3.querySelector("#J3dispo-2");
const dispoRTD = J3.querySelector("#J3dispo-RTD");
if(J3red.checked == true){
    console.log("it works");
    J3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J3c1.checked == true){
      J3.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J3.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      } 
function justifyJ4() {
const J4red = J4.querySelector("#J4-redbtn");
const J4c1 = J4.querySelector("#J4-1-btn");
const dispored = J4.querySelector("#J4dispo-red");
const dispo1 = J4.querySelector("#J4dispo-2");
const dispoRTD = J4.querySelector("#J4dispo-RTD");
if(J4red.checked == true){
    console.log("it works");
    J4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J4c1.checked == true){
      J4.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J4.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }  
function justifyJ5() {
const J5red = J5.querySelector("#J5-redbtn");
const J5c1 = J5.querySelector("#J5-1-btn");
const dispored = J5.querySelector("#J5dispo-red");
const dispo1 = J5.querySelector("#J5dispo-2");
const dispoRTD = J5.querySelector("#J5dispo-RTD");
if(J5red.checked == true){
    console.log("it works");
    J5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J5c1.checked == true){
      J5.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }  
function justifyJ6() {
const J6red = J6.querySelector("#J6-redbtn");
const J6c1 = J6.querySelector("#J6-1-btn");
const dispored = J6.querySelector("#J6dispo-red");
const dispo1 = J6.querySelector("#J6dispo-2");
const dispoRTD = J6.querySelector("#J6dispo-RTD");
if(J6red.checked == true){
    console.log("it works");
    J6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J6c1.checked == true){
      J6.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J6.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }  
function justifyJ7() {
const J7red = J7.querySelector("#J7-redbtn");
const J7c1 = J7.querySelector("#J7-1-btn");
const dispored = J7.querySelector("#J7dispo-red");
const dispo1 = J7.querySelector("#J7dispo-1");
const dispoRTD = J7.querySelector("#J7dispo-RTD");
if(J7red.checked == true){
    console.log("it works");
    J7.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J7.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J7c1.checked == true){
      J7.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J7.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }  

function justifyJ8() {
const J8red = J8.querySelector("#J8-redbtn");
const J8c1 = J8.querySelector("#J8-1-btn");
const dispored = J8.querySelector("#J8dispo-red");
const dispo1 = J8.querySelector("#J8dispo-1");
const dispoRTD = J8.querySelector("#J8dispo-RTD");
if(J8red.checked == true){
    console.log("it works");
    J8.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J8.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J8c1.checked == true){
      J8.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J8.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }  
function justifyJ9() {
const J9red = J9.querySelector("#J9-redbtn");
const J9c1 = J9.querySelector("#J9-1-btn");
const dispored = J9.querySelector("#J9dispo-red");
const dispo1 = J9.querySelector("#J9dispo-1");
const dispoRTD = J9.querySelector("#J9dispo-RTD");
if(J9red.checked == true){
    console.log("it works");
    J9.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J9.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J9c1.checked == true){
      J9.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J9.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      } 
function justifyJ10() {
const J10red = J10.querySelector("#J10-redbtn");
const J10c1 = J10.querySelector("#J10-1-btn");
const dispored = J10.querySelector("#J10dispo-red");
const dispo1 = J10.querySelector("#J10dispo-1");
const dispoRTD = J10.querySelector("#J10dispo-RTD");
if(J10red.checked == true){
    console.log("it works");
    J10.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J10.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J10c1.checked == true){
      J10.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J10.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      } 
function justifyJ11() {
const J11red = J11.querySelector("#J11-redbtn");
const J11c1 = J11.querySelector("#J11-1-btn");
const dispored = J11.querySelector("#J11dispo-red");
const dispo1 = J11.querySelector("#J11dispo-1");
const dispoRTD = J11.querySelector("#J11dispo-RTD");
if(J11red.checked == true){
    console.log("it works");
    J11.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J11.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J11c1.checked == true){
      J11.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J11.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      } 
 function justifyJ12() {
const J12red = J12.querySelector("#J12-redbtn");
const J12c1 = J12.querySelector("#J12-1-btn");
const dispored = J12.querySelector("#J12dispo-red");
const dispo1 = J12.querySelector("#J12dispo-1");
const dispoRTD = J12.querySelector("#J12dispo-RTD");
if(J12red.checked == true){
    console.log("it works");
    J12.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J12.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J12c1.checked == true){
      J12.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J12.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      } 
function justifyJ13() {
const J13red = J13.querySelector("#J13-redbtn");
const J13c1 = J13.querySelector("#J13-1-btn");
const dispored = J13.querySelector("#J13dispo-red");
const dispo1 = J13.querySelector("#J13dispo-1");
const dispoRTD = J13.querySelector("#J13dispo-RTD");
if(J13red.checked == true){
    console.log("it works");
    J13.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J13.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J13c1.checked == true){
      J13.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J13.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      } 
function justifyJ14() {
const J14red = J14.querySelector("#J14-redbtn");
const J14c1 = J14.querySelector("#J14-1-btn");
const dispored = J14.querySelector("#J14dispo-red");
const dispo1 = J14.querySelector("#J14dispo-1");
const dispoRTD = J14.querySelector("#J14dispo-RTD");
if(J14red.checked == true){
    console.log("it works");
    J14.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J14.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J14c1.checked == true){
      J14.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J14.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      } 
function justifyJ15() {
const J15red = J15.querySelector("#J15-redbtn");
const J15c1 = J15.querySelector("#J15-1-btn");
const dispored = J15.querySelector("#J15dispo-red");
const dispo1 = J15.querySelector("#J15dispo-1");
const dispoRTD = J15.querySelector("#J15dispo-RTD");
if(J15red.checked == true){
    console.log("it works");
    J15.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J15.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J15c1.checked == true){
      J15.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J15.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      } 
function justifyJ16() {
const J16red = J16.querySelector("#J16-redbtn");
const J16c1 = J16.querySelector("#J16-1-btn");
const dispored = J16.querySelector("#J16dispo-red");
const dispo1 = J16.querySelector("#J16dispo-1");
const dispoRTD = J16.querySelector("#J16dispo-RTD");
if(J16red.checked == true){
    console.log("it works");
    J16.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J16.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J16c1.checked == true){
      J16.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J16.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      } 
function justifyJ17() {
const J17red = J17.querySelector("#J17-redbtn");
const J17c1 = J17.querySelector("#J17-1-btn");
const dispored = J17.querySelector("#J17dispo-red");
const dispo1 = J17.querySelector("#J17dispo-1");
const dispoRTD = J17.querySelector("#J17dispo-RTD");
if(J17red.checked == true){
    console.log("it works");
    J17.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J17.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J17c1.checked == true){
      J17.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J17.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      } 
function justifyJ18() {
const J18red = J18.querySelector("#J18-redbtn");
const J18c1 = J18.querySelector("#J18-1-btn");
const dispored = J18.querySelector("#J18dispo-red");
const dispo1 = J18.querySelector("#J18dispo-1");
const dispoRTD = J18.querySelector("#J18dispo-RTD");
if(J18red.checked == true){
    console.log("it works");
    J18.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    J18.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(J18c1.checked == true){
      J18.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        J18.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      } 

 




function justifyL1() {
const L1red = L1.querySelector("#L1-redbtn");
const L1c1 = L1.querySelector("#L1-1-btn");
const dispored = L1.querySelector("#L1dispo-red");
const dispo1 = L1.querySelector("#L1dispo-2");
const dispoRTD = L1.querySelector("#L1dispo-RTD");
if(L1red.checked == true){
    console.log("it works");
    L1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    L1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(L1c1.checked == true){
      L1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        L1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      } 
function justifyL2() {
const L2red = L2.querySelector("#L2-redbtn");
const L2c1 = L2.querySelector("#L2-1-btn");
const dispored = L2.querySelector("#L2dispo-red");
const dispo1 = L2.querySelector("#L2dispo-2");
const dispoRTD = L2.querySelector("#L2dispo-RTD");
if(L2red.checked == true){
    console.log("it works");
    L2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    L2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(L2c1.checked == true){
      L2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        L2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyL3() {
const L3red = L3.querySelector("#L3-redbtn");
const L3c1 = L3.querySelector("#L3-1-btn");
const dispored = L3.querySelector("#L3dispo-red");
const dispo1 = L3.querySelector("#L3dispo-2");
const dispoRTD = L3.querySelector("#L3dispo-RTD");
if(L3red.checked == true){
    console.log("it works");
    L3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    L3.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(L3c1.checked == true){
      L3.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        L3.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyL4() {
const L4red = L4.querySelector("#L4-redbtn");
const L4c1 = L4.querySelector("#L4-1-btn");
const dispored = L4.querySelector("#L4dispo-red");
const dispo1 = L4.querySelector("#L4dispo-2");
const dispoRTD = L4.querySelector("#L4dispo-RTD");
if(L4red.checked == true){
    console.log("it works");
    L4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    L4.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(L4c1.checked == true){
      L4.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        L4.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyL5() {
const L5red = L5.querySelector("#L5-redbtn");
const L5c1 = L5.querySelector("#L5-1-btn");
const dispored = L5.querySelector("#L5dispo-red");
const dispo1 = L5.querySelector("#L5dispo-2");
const dispoRTD = L5.querySelector("#L5dispo-RTD");
if(L5red.checked == true){
    console.log("it works");
    L5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    L5.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(L5c1.checked == true){
      L5.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        L5.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyL6() {
const L6red = L6.querySelector("#L6-redbtn");
const L6c1 = L6.querySelector("#L6-1-btn");
const dispored = L6.querySelector("#L6dispo-red");
const dispo1 = L6.querySelector("#L6dispo-2");
const dispoRTD = L6.querySelector("#L6dispo-RTD");
if(L6red.checked == true){
    console.log("it works");
    L6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    L6.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(L6c1.checked == true){
      L6.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        L6.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyL7() {
const L7red = L7.querySelector("#L7-redbtn");
const L7c1 = L7.querySelector("#L7-1-btn");
const dispored = L7.querySelector("#L7dispo-red");
const dispo1 = L7.querySelector("#L7dispo-2");
const dispoRTD = L7.querySelector("#L7dispo-RTD");
if(L7red.checked == true){
    console.log("it works");
    L7.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    L7.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(L7c1.checked == true){
      L7.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        L7.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyL8() {
  const L8red = L8.querySelector("#L8-redbtn");
  const L8c1 = L8.querySelector("#L8-1-btn");
  const dispored = L8.querySelector("#L8dispo-red");
  const dispo1 = L8.querySelector("#L8dispo-2");
  const dispoRTD = L8.querySelector("#L8dispo-RTD");
  if(L8red.checked == true){
      console.log("it works");
      L8.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')}); 
      if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
  }else{
      L8.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(L8c1.checked == true){
        L8.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
        if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};
  
      }else{
          L8.querySelectorAll('.dispobox').forEach(el => {
            el.classList.remove('open')});
            if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
            }
          }
        }
function justifyL9() {
const L9red = L9.querySelector("#L9-redbtn");
const L9c1 = L9.querySelector("#L9-1-btn");
const dispored = L9.querySelector("#L9dispo-red");
const dispo1 = L9.querySelector("#L9dispo-2");
const dispoRTD = L9.querySelector("#L9dispo-RTD");
if(L9red.checked == true){
    console.log("it works");
    L9.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    L9.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(L9c1.checked == true){
      L9.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        L9.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyL10() {
const L10red = L10.querySelector("#L10-redbtn");
const L10c1 = L10.querySelector("#L10-1-btn");
const dispored = L10.querySelector("#L10dispo-red");
const dispo1 = L10.querySelector("#L10dispo-2");
const dispoRTD = L10.querySelector("#L10dispo-RTD");
if(L10red.checked == true){
    console.log("it works");
    L10.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    L10.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(L10c1.checked == true){
      L10.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        L10.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyL11() {
const L11red = L11.querySelector("#L11-redbtn");
const L11c1 = L11.querySelector("#L11-1-btn");
const dispored = L11.querySelector("#L11dispo-red");
const dispo1 = L11.querySelector("#L11dispo-2");
const dispoRTD = L11.querySelector("#L11dispo-RTD");
if(L11red.checked == true){
    console.log("it works");
    L11.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    L11.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(L11c1.checked == true){
      L11.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        L11.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyL12() {
const L12red = L12.querySelector("#L12-redbtn");
const L12c1 = L12.querySelector("#L12-1-btn");
const dispored = L12.querySelector("#L12dispo-red");
const dispo1 = L12.querySelector("#L12dispo-2");
const dispoRTD = L12.querySelector("#L12dispo-RTD");
if(L12red.checked == true){
    console.log("it works");
    L12.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    L12.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(L12c1.checked == true){
      L12.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        L12.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyM1() {
const M1red = M1.querySelector("#M1-redbtn");
const M1c1 = M1.querySelector("#M1-1-btn");
const dispored = M1.querySelector("#M1dispo-red");
const dispo1 = M1.querySelector("#M1dispo-2");
const dispoRTD = M1.querySelector("#M1dispo-RTD");
if(M1red.checked == true){
    console.log("it works");
    M1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    M1.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(M1c1.checked == true){
      M1.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        M1.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
function justifyM2() {
const M2red = M2.querySelector("#M2-redbtn");
const M2c1 = M2.querySelector("#M2-1-btn");
const dispored = M2.querySelector("#M2dispo-red");
const dispo1 = M2.querySelector("#M2dispo-2");
const dispoRTD = M2.querySelector("#M2dispo-RTD");
if(M2red.checked == true){
    console.log("it works");
    M2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')}); 
    if(!dispored.classList.contains("open")){dispored.classList.toggle("open");greenbtn.classList.add("closed")}
}else{
    M2.querySelectorAll('.dispobox').forEach(el => {
      el.classList.remove('open')});
    if(M2c1.checked == true){
      M2.querySelectorAll('.dispobox').forEach(el => {
        el.classList.remove('open')});
      if(!dispo1.classList.contains("open")){dispo1.classList.toggle("open"); greenbtn.classList.add("closed")};

    }else{
        M2.querySelectorAll('.dispobox').forEach(el => {
          el.classList.remove('open')});
          if(!dispoRTD.classList.contains("open")&& greenbtn.classList.contains("closed")){dispoRTD.classList.toggle("open")}
          }
        }
      }
