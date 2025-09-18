// Register service worker with content update handling
if ('serviceWorker' in navigator) {
  const swPath = '/test2/serviceWorker.js';
  const scope = '/test2/';
  
  let registration;
  
  // Function to check for content updates
  function checkForContentUpdates() {
    if (registration) {
      // Send message to service worker to check for updates
      registration.active.postMessage({
        type: 'CHECK_UPDATES',
        urls: [
          '/test2/index.html',
          '/test2/testing.css',
          '/test2/testing.js',
          '/test2/manifest.json'
        ]
      });
    }
  }
  
  // Register service worker
  navigator.serviceWorker.register(swPath, { scope: scope })
    .then(reg => {
      registration = reg;
      console.log('SW registered successfully with scope:', reg.scope);
      
      // Check for content updates when page becomes visible
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForContentUpdates();
        }
      });
      
      // Check for content updates on page load
      window.addEventListener('load', function() {
        checkForContentUpdates();
      });
      
      // Listen for content update messages from service worker
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data.type === 'CONTENT_UPDATED') {
          console.log('Content updated:', event.data.url);
          // You can show a notification to the user here
          if (confirm('New content is available. Reload to see changes?')) {
            window.location.reload();
          }
        }
      });
      
      // Listen for controller change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New service worker activated, reloading page');
        window.location.reload();
      });
      
      // If there's a waiting service worker, prompt user to update
      if (reg.waiting) {
        showUpdateNotification(reg.waiting);
      }
      
      // Listen for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              showUpdateNotification(newWorker);
            }
          }
        });
      });
    })
    .catch(error => {
      console.log('SW registration failed:', error);
    });
  
  // Function to show update notification
  function showUpdateNotification(worker) {
    if (confirm('A new version is available. Update now?')) {
      worker.postMessage({ action: 'skipWaiting' });
    }
  }
  
  // Manual update check function (can be called from a button)
  window.checkForUpdates = function() {
    if (registration) {
      registration.update().then(() => {
        checkForContentUpdates();
        alert('Update check completed');
      });
    }
  };
}

    var container = document.querySelector('.container');
    var backBtn = document.getElementById('backBtn');
    var main = document.querySelector("#main-categories");
    var menuIcon = document.getElementById('menuIcon');
    var menuIconBox = document.getElementById('menuIconBox');
    var infoContent = document.getElementById('infoContent');
    var infoLabel = document.querySelector(".subcategory-header")

const  
  A1DP1 =["DP1. Symptoms greater than 10 days, immunosuppression, inhaled steroid medications are related to diseases that are unlikely to go away without treatment. Hoarseness longer than 2 weeks requires a full laryngeal exam."],
  A1DP2 =["DP2. 4 questions that look at the chance of having a Group A Streptococcal (GAS) infection. If 3 of the questions are positive, there is 32% chance of having GAS and a rapid antigen test (RADT) should be performed. The RADT is effective for ruling out GAS in adults but some Soldiers with GAS are missed. Culture test is performed when the RADT is negative and Soldiers or their contacts are at higher risk for complications from a GAS infection. Culture generally takes 24-48 hours for the results to return."],
  A1DP3 =["Other protocols. Sore throat and hoarseness that are associated with a virus should be treated with minor-care. The other symptoms should be treated according to their associated protocols.","MCP for sore throat. A sore throat is often due to a viral infection. Minor-care consist of pain control, measures to decrease inflammation, getting plenty of rest and drinking plenty of fluids (water). Return for signs of the infection getting worse or progressing.","MCP for hoarseness. Hoarseness is often due to a virus or irritant. Minor-care consists of resting the vocal cords and avoidance of irritants (cigarette smoking, yelling, heartburn, post-nasal drip). This is a good opportunity to discuss the negative effects of tobacco use and encourage the Soldier to quit using tobacco, if applicable."],
  A1DP4 =[],
  A1DPRE = ["DP3.  CENTOR score < 2 low risk of strep throat, screen other symptoms if present"],
  A1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” One-sided severe sore throat with fever, trouble swallowing as shown by drooling, uvula displacement, hoarseness (hot potato voice), trismus (lock jaw), and enlarged, tender tonsils are signs of a deep neck space infection like a peritonsillar abscess. Shortness of breath and stridor are signs of upper airway obstruction due to severe pharyngeal inflammation.",],
  A1PRO = ["MCP sore throat: For pain: lozenge first line, ibuprofen second line, for elevated temperature: acetaminophen, salt water gargles and drink warm fluids for inflammation","MCP hoarseness: rest vocal cords and avoid irritants (cigarette smoking, yelling, heartburn","Return if not improving in 3 days or immediately if worsening symptoms or red flags (above)."],
  A1LIMITATIONS = ["None"],
  A1GEN = ["pg. 19-20:","A sore throat is often due to a viral infection. Bacterial infections and other causes need to also be considered."],
  A1MEDCOM = ["Obtain a Throat Culture pg. 68(13)"],
  A1STP1 = ["Subject Area 6: Primary Care. Perform a head, eyes, ears, nose, and throat (HEENT) Exam. 081-833-0254", "Subject Area 6: Primary Care. Provide Care for Common Throat Infections. 081-833-0243","Subject Area 15: Primary Care (SL2). Obtain a Throat Culture. 081-833-0248"],
  A1DDX = ['Viral Infections', 'Bacterial Infection', 'Meningitis', 'Neck Deep Tissue Infection', 'Candida infection', 'Strep Throat'],
  A2ACT1 = [],
  A2ACT2 = [],
  A2ACT3 = [],  
  A2DP1 = ["DP1. Signs of infection. All Soldiers with otitis media or moderate to severe otitis externa should be evaluated by a privileged provider to be considered for antibiotics."],
  A2DP2 = ["DP2. Vertigo requires an internal ear evaluation. Longer timeline and decreased hearing can be signs of a complication from an ear infection or alternate cause requiring a qualified provider evaluation."],
  A2DP3 = ["Mild otitis externa, temporal-mandibular joint (TMJ) dysfunction, and ear pain with normal exam should be treated with minor-care.","MCP for otitis externa. Soak wick of a cotton ball wick with OTC ear drops. Place in the ear for 24 hours while using the drops. Remove the cotton wick and continue drops for 1 week (3 days after the symptoms have resolved). Keep the ear canal dry. Use OTC ibuprofen as needed for pain. Return to clinic if not resolved in 1 week or worsening symptoms to include pain or fever.","MCP for TMJ is another common cause of pain around the ear. Evaluation includes seeing if the pain increases with opening and closing the jaw while placing the finger on the anterior inside of the ear to feel the joint. Ensure pain is not related to the heart. Use OTC ibuprofen for inflammation and pain. Refer to dental if history of teeth grinding. Instruct on avoidance of triggers (excessive chewing, chewing gum). Home therapy is jaw isometric exercises: jaw is open 1 inch and jaw is pushed 1) down against a loosely fisted hand and 2) forward against a hand for 5 seconds each, each set is repeated 5 times per session with 3 sessions per day. Return if not improving within three days."],
  A2DP4 = [],
  A2DPRE = ["DP3. Evaluate for cold symptoms and sore throat that can be associated with ear pain with their respective protocols."],
  A2DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” A stiff neck and fever are signs of meningitis, and all Soldiers with signs of meningitis should be seen by a privileged provider as soon as possible. Mastoid symptoms can be a sign of mastoiditis."],
  A2PRO = ["MCP for Mild Otitis Externa: Soak wick of a cotton ball with ear drops. Place in the ear for 24 hours while using the drops. Remove the cotton wick and continue drops for 1 week (3 days after the symptoms have resolved). Keep the ear canal dry","MCP for TMJ: Refer to dental if history of teeth grinding, ibuprofen as needed for pain, instruct on avoidance of triggers and home jaw exercises.","Return if not improving in 3 days, worsening symptoms, dizziness, loss of hearing, stiff neck."],
  A2LIMITATIONS = ["Otitis Externa: Avoidance of situations requiring utilization of ear plugs, No swimming","Eustachian Tube Dysfunction: No scuba diving"],
  A2GEN = ["pg. 21-22"],
  A2MEDCOM = ["Administer Otic Medications pg.67 (3)(b)"],
  A2STP1 = ["Subject Area 6: Primary Care. Perform a HEENT Exam. 081-833-0254"," Subject Area 6: Primary Care. Provide Treatment for Common Ear Infections. 081-833-0241 ","Subject Area 18: Medication Administration. Administer Ear Medications. 081-833-0020"],
  A2DDX = ["Otitis Media/Externa", "Esutachian tube dysfunction", "Nasopharyngeal pathology", "Deep space head/neck infections", "Meningitis", "Mastoiditis", "Ruptured Ear Drum", "TMJ Dysfunction"],
  A3ACT1 = ["Place Mask"],
  A3ACT2 = ["Place Mask"],
  A3ACT3 = ["Place Mask"],
  A3DP1 = ["DP1: Soldier with an ongoing productive cough may be contagious and needs to be evaluated for quarters.", "Viral symptoms that are improving and then get worse or onset of severe pain over the cheekbones/back upper teeth (sinuses) can be a sign of a sinus problem requiring prescription medications."],
  A3DP2 = ["DP2: Purulent material is thick, yellow/greenish, foul smelling nasal discharge. Purulent discharge can be a sign of an infection or a retained foreign body in the nose.", "If symptoms have been going on for over seven days, evaluate for a bacterial infection."],
  A3DP3 = ["Treatment Protocol: Most upper respiratory tract infection symptoms which include sore throat and ear pain are caused by a virus or allergies and do not require antibiotics. Minor-care is focused on improving the symptoms that the Soldier is having while the issue resolves on its own.","MCP Cold: Counsel the Soldier to drink plenty of fluids and rest, cover their mouth when they cough and wash hands to prevent spread.","Ibuprofen for pain, acetaminophen for elevated temperature, decongestant for nasal congestion, guaifenesin for mucous, or antihistamine for allergies","Return to clinic if not improving within 1 week, worsening symptoms, fever, new sinus pain, lightheadedness, or pain in the neck."],
  A3DP4 = [],
  A3DPRE = [],
  A3DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Shortness of breath and abnormal pulse oxygenation suggest respiratory compromise. The soldier should be immediately started on oxygen pending further evaluation. Fever with a stiff neck suggests meningitis. Quick Sequential (sepsis-related) Organ Failure Assessment (qSOFA) is comprised of a respiratory rate greater than 21, systolic blood pressure less than 101, and Glasgow coma scale less than 15. Coughing up blood clots or quarter sized amounts of blood can be a sign of bleeding within the lungs.","DP1. Soldier with an ongoing productive cough may be contagious and needs to be evaluated for quarters. Viral symptoms that are improving and then get worse or onset of severe pain over the cheekbones/back upper teeth (sinuses) can be a sign of a sinus problem requiring prescription medications."],
  A3PRO = ["MCP for Cold: Counsel the Soldier to drink plenty of fluids, get plenty of rest, and to cover their mouth when coughing and wash their hands to prevent spread.","Stop or limit smoking.","Ibuprofen for pain, Acetaminophen for elevated temperature, decongestant for nasal congestion, guaifenesin for mucous, or antihistamine for allergies","Return if it does not improve in 7 days, worsening symptoms, develop sinus pain, lightheaded, neck pain, or fever."],
  A3LIMITATIONS = ["Consider quarters/ contagious precautions while febrile"],
  A3GEN = ["pg. 23-24:","If a Soldier states that they have a cold, determine what complaint to screen by asking, “What do you mean by a cold?” If his/her complaint can be screened by another protocol, use that protocol."],
  A3MEDCOM = ["Administer Antihistamines pg.67 (3)(j)","Administer Allergy Shots/Skin Testing pg.67 (2)","Provide Oxygen pg.69 (2)(h)"],
  A3STP1 = ["Subject Area 6: Primary Care. Perform a HEENT Exam. 081-833-0254","Subject Area 6: Primary Care. Provide Treatment for Sinus Infections. 081-833-0242","Subject Area 6: Primary Care. Provide Care for Common Throat Infections. 081-833-0243","Subject Area 6: Primary Care. Provide Care for Common Respiratory Disorders. 081-833-0245"],
  A3DDX = ["Allergic or seasonal rhinitis","Bacterial pharyngitis or tonsillitis","Acute bacterial rhinosinusitis","Influenza","Pertussis"],
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
  A4LIMITATIONS = ["Avoid loud noise exposure x 48 hours"],
  A4GEN = ["pg. 25-26"],
  A4MEDCOM = ["Administer Otic Medications pg.67 (3)(b) "],
  A4STP1 = ["Subject Area 6: Primary Care. Perform a HEENT Exam. 081-833-0254","Subject Area 6: Primary Care. Provide Treatment for Common Ear Infections. 081-833-0241","Subject Area 15: Primary Care. Irrigate an Obstructed Ear. 081-833-0059 ","Subject Area 18: Medication Administration. Administer Ear Medications. 081-833-0020"],
  A4DDX = ['Cerumen Impaction','Otitis Media','Otosclerosis','Ruptured Ear Drum','Eustachian Tube Dysfunction','Hearing Loss','Disorders of the Jaw Joint','Severe Anxiety','Neck Injuries'],
  A5ACT1 = ['Ear irrigation if wax and TM intact'],
  A5ACT2 = [],
  A5ACT3 = [],
  A5DP1 = ["DP2. Soldiers who have had trauma to the nose with an associated nosebleed require further screening. ","A misaligned broken nose can affect the upper airway and increase the risk of future sinus infections. Other injuries can be associated with the force that caused the trauma and nosebleed. ","Nosebleed while on anticoagulants can make it more difficult to stop a nosebleed and be a sign that the anticoagulation level is too high. ","Purulent discharge can be related to a retained foreign body or a concurrent infection that requires additional treatment. ","Recurrent nosebleeds not associated with a cold can be a sign of a bleeding disorder."],
  A5DP2 = [],
  A5DP3 = ["MCP Nosebleed. Once the bleeding is controlled, tell the Soldier to avoid vigorous blowing of the nose. If the room air is dry a humidifier or vaporizer often helps. Instruct the Soldier to return for medical assistance if the bleeding recurs and is not able to be controlled with tilting the head forward and applying external pressure with the thumb and index finger for 5 minutes or if the amount of blood lost at one time is enough to soak a wash cloth (ask the Soldier to bring in his wash cloth). ","Saline nasal spray can be used to prevent future nosebleeds if the air is dry after the initial nosebleed has resolved. ","Decongestant (Oxymetazoline) can be used to constrict the blood vessels."],
  A5DP4 = [],
  A5DPRE = ["DP3. Cold symptoms often result in nosebleeds from recurrent blowing of the nose, rubbing the nose with a tissue after blowing it, picking the nose from congestion, and prominent blood vessels from allergies or inflammation. ","Soldiers with symptoms of runny nose, congestion, or allergies should be screened with the cold symptoms protocol."],
  A5DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Orthostatic hypotension is a sign of volume depletion and can represent a significant amount of blood loss.","Nosebleeds normally result from the rupture of small blood vessels inside the nose related to mucosal trauma (nose picking) or irritation (dry climate, blowing nose). 90% occur in the front of septum in the nose and can be controlled by applying external pressure. If the bleeding does not stop, then the nosebleed likely is coming from the back of the nose and needs to be controlled by a privileged provider."],
  A5PRO = ["Do not blow the nose vigorously or wipe the middle of the nose, as it can cause a nosebleed.","Medications: nasal saline for prevention if the air is dry, oxymetazoline if recurrent with nasal sx.","Humidifier can also be used if the air is dry.","Return if unable to get a recurrent nosebleed to stop, notice bleeding from other sites, feeling lightheaded or tired, losing a significant amount of blood, or recurrent without common cold sx."],
  A5LIMITATIONS = [],
  A5GEN = ["pg. 27-28: ","Nosebleeds normally result from the rupture of small blood vessels inside the nose related to mucosal trauma (nose picking) or irritation (dry climate, blowing nose). 90% occur in the front of septum in the nose and can be controlled by applying external pressure. If the bleeding does not stop, then the nosebleed likely is coming from the back of the nose and needs to be controlled by a privileged provider."],
  A5MEDCOM = ["N/A"],
  A5STP1 = ["Subject Area 6: Primary Care. Perform a HEENT Exam. 081-833-0254"],
  A5DDX = ["Upper Respiratory Infections","Allergic or Viral Rhinitis","Trauma","Bleeding Disorder","Foreign Body"],

  B1ACT1 = [],
  B1ACT2 = [],
  B1ACT3 = [],
  B1DP1 = ["DP2. Back pain associated with pain, numbness, or tingling running down into the legs may represent central or peripheral nerve impingement and requires further evaluation. Refer to a physical therapist if direct referral is available locally."],
  B1DP2 = ["MCP Low back pain (LBP). LBP is extremely common in Soldiers. The best treatment is conservative measures including a home exercise program for mobilization and strengthening, ice and heat as needed for inflammation, and pain control with analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Follow established local protocols for home exercise that focus on stretching the lower back and hamstrings multiple times per day, strengthening the core muscles daily, and pain control as needed. Often obesity is a factor in low back pain and Soldiers should be encouraged to lose weight. Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, worsening of other symptoms, symptoms last longer than one week. ","If direct access to physical therapy (physical therapy sick call) is available, consider direct referral to physical therapy in accordance with local policy."],
  B1DP3 = [],
  B1DP4 = [],
  B1DPRE = [],
  B1DPRED = ["Red Flags/DP1. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”","DP1. A focused history and physical exam is essential to localizing a Soldier’s complaint of back pain and identifying its source. The HPI should include an OPQRST evaluation of the complaint and the ROS should specifically address red flag symptoms as well as questions related but not limited to infection, trauma, cardiopulmonary, gastrointestinal, and genitourinary, or gynecological complaints."],
  B1PRO = ["Provide home exercise program, activity modification as appropriate","Intermittent ice or heat IAW local protocol for inflammation","Medication: analgesic balm for mild pain, Ibuprofen (1st line) and Ketorolac (2nd line) for moderate pain as needed","Refer to PT if direct access is available","Follow-up: Immediate follow-up for a DP1 or DP2 symptoms. Routine follow-up is recommended for any symptoms that do not improve or worsen"],
  B1LIMITATIONS = ["No repetitive bending or lifting but may lift/ carry up to 40lbs", "Perform stretching, core strengthening home regiment during PT", "No ruck marching, running, or jumping but may walk, bike, or swim for cardio"],
  B1GEN = ["pg. 29-30: ","A focused history and physical exam is essential to localizing a Soldier’s complaint of back pain and identifying its source. The HPI should include an OPQRST evaluation of the complaint and the ROS should specifically address red flag symptoms as well as questions related but not limited to infection, trauma, cardiopulmonary, gastrointestinal, and genitourinary, or gynecological complaints."],
  B1MEDCOM = ["Initial Management of Fractures/Spinal Injury. pg.69 (2)(d)"],
  B1STP1 = ["Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222"],
  B1DDX = ["Muscle Sprain/Strain"," Fracture"," Infection ","Renal Stone/UTI ","Arthritis ","Cauda Equina Syndrome"],

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
  B2GEN = ["pg. 31-32"],
  B2MEDCOM = ["Initial Management of Fractures/Spinal Injury pg.69(2)(d)"],
  B2STP1 = ["Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders 081-833-0222","Subject Area 3: Trauma Treatment. Initiate Treatment for Neck Wounds 081-833-0091","Subject Area 3: Trauma Treatment. Apply a Cervical Collar 081-833-0177","Subject Area 3: Trauma Treatment. Apply a Long Spine Board 081-833-0181"],
  B2DDX = ["Muscle Strain", "Fracture", "Meningitis", "Flu", "Deep neck space infection"],

  B3ACT1 = ["Immobilize the injured extremity before transport or referral"],
  B3ACT2 = ["Immobilize the injured extremity before transport or referral"],
  B3ACT3 = [],
  B3DP1 = ["DP 1. The red flags indicate a medical emergency. Immobilize the affected extremity prior to transport if associated with trauma. Immediately refer shoulder pain associated with cardiac symptoms (sweating, shortness of breath, chest or jaw pain/ pressure). A red, warm, swollen joint or pain with fever can be a sign of an infected joint requiring immediate surgical evaluation. Abdominal symptoms suggest an extrinsic cause requiring evaluation."],
  B3DP2 = ["DP2. Neurologic symptoms (numbness, weakness) suggest nerve impingement. Limited motion suggests a more significant injury that should be placed in a sling and require further evaluation. Laceration may require closure."],
  B3DP3 = ["MCP. The best treatment is conservative measures including a home exercise program for mobilization and strengthening and analgesics as needed. A temporary profile may be required. Instruct the Soldier to work the injured shoulder through its range of motion (but not vigorous enough to cause pain) at least twice each day to preserve mobility after a 20-minute application of ice. Follow established local protocols for home exercise. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, worsening of other symptoms, symptoms last longer than one week.","Refer to PT if direct access to physical therapy (physical therapy sick call) is available, in accordance with local policy."],
  B3DP4 = [],
  B3DPRE = [],
  B3DPRED = ["Red Flags: If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Abnormal distal pulse or sensation in the setting of trauma is a medical emergency require immediate evaluation. Deformity can be a dislocated shoulder or fracture. Myocardial infarction can be associated with shoulder pain."],
  B3PRO = ["Provide home exercise program. Activity modification as appropriate","Intermittent ice or heat for inflammation","Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed","Refer to PT if direct access is available","Follow-up: Immediate follow-up for a DP1 or DP2 symptoms. Routine follow-up is recommended for any symptoms that do not improve or worsen."],
  B3LIMITATIONS = ["May lift, push, pull up to 5 lbs","No overhead lifting or repetitive activities","Perform stretching, core strengthening home regiment during PT"],
  B3GEN = ["Pg. 33-34: ","Anterolateral shoulder pain worsened by reaching overhead can be related to impingement syndrome, AC joint pathology, or rotator cuff injury. Posterior shoulder pain could be from rotator cuff injury, gallbladder, spleen, or neck."],
  B3MEDCOM = ["Initial Management of Fractures/Spinal Injury. pg.69 (2)(d)"],
  B3STP1 = ["Subject Area 7: Musculoskeletal. Perform an Examination of the Shoulder. 081-833-0269", "Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222"],
  B3DDX = ["Tendon inflammation/tear","Instability (dislocation)","Arthritis","Fracture","Myocardial Infarction"],

  B4ACT1 = ["Immobilize the injured extremity before transport or referral"],
  B4ACT2 = [],
  B4ACT3 = [],
  B4DP1 = ["DP2. Limited ROM and swelling may represent an issue within the joint requiring further evaluation. Neck and shoulder issues may refer pain to the elbow. Ulnar nerve pain may be referred to the ulnar side of the forearm, hand, pinky, and ring finger area."],
  B4DP2 = ["MCP. The best treatment is conservative measures including a home exercise program for mobilization and strengthening and analgesics as needed. A temporary profile may be required. Instruct the Soldier to work the injured elbow through its range of motion at least twice each day to preserve mobility. This should ideally be done after a 20-minute application of ice. The range of motion exercise should not be vigorous enough to cause pain. Follow established local protocols for home exercise. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, worsening of other symptoms, symptoms last longer than one week.","If direct access to physical therapy (physical therapy sick call) is available, consider direct referral to physical therapy in accordance with local policy."],
  B4DP3 = [],
  B4DP4 = [],
  B4DPRE = [],
  B4DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Abnormal distal pulse or sensation in the setting of trauma is a medical emergency requiring immediate evaluation.","DP 1. Immobilize the affected extremity prior to transport if associated with trauma. A red, warm, swollen joint or pain with fever can be a sign of an infected joint requiring immediate surgical evaluation. Diffuse pain that involves multiple joints or muscles may represent a systemic cause and requires further evaluation."],
  B4PRO = ["Provide home exercise program. Activity modification as appropriate","Intermittent ice or heat for inflammation","Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed","Refer to PT if direct access is available","Follow-up: Immediate follow-up for a DP1 or DP2 symptoms. Routine follow-up is recommended for any symptoms that do not improve or worsen."],
  B4LIMITATIONS = ["May lift, push, pull up to 5 lbs","No repetitive bending of elbow or turning/ bending of wrist","Perform stretching, core strengthening home regiment during PT"],
  B4GEN = ["Pg. 35-36: ","Elbow joint is formed by the connection of the distal humerus and the proximal radius (radial head). Epicondyles are bony prominences on the medial and lateral side of the distal humerus and are the site tendon attachment for muscles of the lower arm. Lateral elbow pain may represent tennis elbow, radiohumeral joint pain, or referred pain."],
  B4MEDCOM = ["Initial Management of Fractures/Spinal Injury. pg.69 (2)(d)"],
  B4STP1 = ["Subject Area 7: Musculoskeletal. Perform an Examination of the Elbow. 081-833-0270","Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222"],
  B4DDX = ["Muscle Strain","Fracture","Dislocation","Tendonitis","Bursitis"],

//B5
  B5ACT1 = ["Immobilize the injured extremity before transport or referral"],
  B5ACT2 = [],
  B5ACT3 = [],
  B5DP1 = ["DP2. Index finger or thumb numbness, pain, or weakness are symptoms of carpal tunnel syndrome. Clicking or popping with pain can be a sign of tendon instability. Ganglion is a mobile mass over a tendon that can be referred for drainage and treatment."],
  B5DP2 = ["MCP. The best treatment is conservative measures including a home exercise program for mobilization and strengthening and analgesics as needed. Instruct the Soldier to work the injured wrist through its range of motion (but not vigorous enough to cause pain) at least twice each day to preserve mobility after a 20-minute application of ice. Follow established local protocols for home exercise. Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain. Instruct the Soldier to seek medical assistance if pain becomes severe enough to prevent performance of normal duties/activities, worsening of other symptoms, symptoms last longer than one week.","If direct access to physical therapy (physical therapy sick call) is available, consider direct referral to physical therapy in accordance with local policy."],
  B5DP3 = [],
  B5DP4 = [],
  B5DPRE = [],
  B5DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Abnormal distal pulse or sensation in the setting of trauma is a medical emergency requiring immediate evaluation.","DP 1. In the setting of trauma, the red flags are an indicator of a medical emergency. Immobilize the affected extremity prior to transport. A red, warm, swollen joint or pain with fever can be a sign of an infected joint requiring immediate surgical evaluation. Trauma and Pain without recent trauma or overuse injury may represent a systemic problem to include rheumatoid arthritis or Lyme disease."],
  B5PRO = ["Provide home exercise program. Activity modification as appropriate","Intermittent ice or heat for inflammation","Medication: analgesic balm for mild pain, ibuprofen (1st line) and ketorolac (2nd line) for moderate pain as needed","Refer to PT if direct access is available","Follow-up: Immediate follow-up for a DP1 or DP2 symptoms. Routine follow-up is recommended for any symptoms that do not improve or worsen."],
  B5LIMITATIONS = ["May lift, push, pull up to 5 lbs","May wrap or wear a brace for comfort","No repetitive bending of wrist","Perform stretching, core strengthening home regiment during PT"],
  B5GEN = ["Pg. 37-38: ","Wrist pain usually occurs from trauma or overuse. Falling on an outstretched hand can result in a scaphoid (falling forward) or lunate/ triquetrum (falling back) injury. Ulnar side of wrist may involve tendinopathy, triangular fibrocartilage complex injury, or fracture. Radial side of wrist may involve tendinopathy, ligamentous injury, or fracture. Dorsal pain may involve a wrist sprain or fracture. Volar pain may involve fracture, ganglion, or carpal tunnel syndrome."],
  B5MEDCOM = ["Initial Management of Fractures/Spinal Injury. pg.69 (2)(d)"],
  B5STP1 = ["Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222","Subject Area 7: Musculoskeletal. Perform an Examination of the Wrist. 081-833-0273"],
  B5DDX = ["Fracture","Carpal Tunnel","Arthritis","Bursitis","Tendonitis","Muscle Strain"],


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
  B6GEN = ["Pg. 39-40: ","Any deviation of the hand from normal function can result in significant disability. Hand and finger injury are common in Soldiers."],
  B6MEDCOM = ["Initial Management of Fractures/Spinal Injury. pg.69 (2)(d)"],
  B6STP1 = ["Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222","Subject Area 7: Musculoskeletal. Apply a Rigid Splint. 081-833-0263","Subject Area 7: Musculoskeletal. Apply an Elastic Bandage. 081-833-0264"],
  B6DDX = ["Fracture/ Dislocation","Gout","Carpal Tunnel Syndrome","Arthritis","Tendonitis","Muscle Strain"],
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
  B7GEN = ["pg. 41-42: ","Lateral pain worse with direct pressure may represent trochanteric bursitis. Anterior hip or groin pain may represent the hip joint injury, fracture (stress fracture), or non-hip issue like inguinal hernia. Femoral stress fractures are more common in initial entry training. They can result in permanent disability if not properly identified and treated."],
  B7MEDCOM = ["Initial Management of Fractures/Spinal Injury. pg.69 (2)(d)"],
  B7STP1 = ["Subject Area 7: Musculoskeletal. Perform an Examination of the Hip. 081-833-0274","Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222","Subject Area 7: Musculoskeletal. Immobilize the Pelvis. 081-833-0266"],
  B7DDX = ["Arthritis","Stress Fracture","Trochanteric Bursitis","Tendinitis","Muscle Strain","Hernia","Referred Pain"],

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
  B8GEN = ["pg. 43-44: ","Knee pain is a common complaint in Soldiers with a complex differential that includes evaluating for trauma, overuse, swelling, and referred pain."],
  B8MEDCOM = ["Initial Management of Fractures/Spinal Injury. pg.69 (2)(d)"],
  B8STP1 = ["Subject Area 7: Musculoskeletal. Perform an Examination of the Knee. 081-833-0268","Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222","Subject Area 7: Musculoskeletal. Apply a Rigid Splint. 081-833-0263","Subject Area 7: Musculoskeletal. Apply an Elastic Bandage. 081-833-0264"],
  B8DDX = ["Ligament or Cartilage Injury","Arthritis","Overuse Injury","Infection/Inflammation","Bursitis"],


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
  B9GEN = ["pg 45-46: ","Ankle pain is a common complaint in Soldiers from overuse or trauma."],
  B9MEDCOM = ["Initial Management of Fractures/Spinal Injury pg.69 (2)(d) "],
  B9STP1 = ["Subject Area 7: Musculoskeletal. Perform an Examination of the Ankle. 081-833-0272 ","Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal Disorders. 081-833-0222","Subject Area 7: Musculoskeletal. Apply a Rigid Splint. 081-833-0263 ","Subject Area 7: Musculoskeletal. Apply an Elastic Bandage. 081-833-0264"],
  B9DDX = ["Sprain/Strain","Fracture","Tendon Rupture","Arthritis","Bursitis","Tendinopathy"],

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
  B10GEN = ["pg. 47-48: ","Common anterior foot pains include around the big toe (bunion, sprain, arthritis, sesamoiditis, ingrown toenail, subungual hematoma) and below the 2nd and 3rd metatarsals (metatarsalgia, Morton’s neuroma, and plantar wart)."],
  B10MEDCOM = ["Initial Management of Fractures/Spinal Injury pg.69 (2)(d)"],
  B10STP1 = ["Subject Area 7: Musculoskeletal. Treat Common Musculoskeletal. Disorders. 081-833-0222 ","Subject Area 7: Musculoskeletal. Apply a Rigid Splint. 081-833-0263 ","Subject Area 7: Musculoskeletal. Apply and Elastic Bandage. 081-833-0264"],
  B10DDX = ["Injury","Overuse","Plantar Fasciitis","Tarsal Tunnel Syndrome","Achilles Tendinopathy","Ingrown Toenail","Bunion"], 

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
  B11DDX = ["Fracture","Laceration","Bruise","Stress Reaction"],

  C1ACT1 = [],
  C1ACT2 = [],
  C1ACT3 = [],
  C1DP1 = ["DP 1. These represent the possibility of more significant underlying medical conditions. A common side effect of chemotherapy treatment is nausea and vomiting that is sometimes difficult to control. BMI less than 18 can be a sign of an eating disorder like bulimia or another significant medical condition. Uncontrolled diabetes and gastroparesis due to diabetes can also present with nausea and vomiting."],
  C1DP2 = ["DP 2. These are symptoms that are related to volume depletion. Fluid depletion is a risk of significant nausea and vomiting. If a Soldier is not able to maintain fluid intake due to his or her nausea and vomiting, then short term hospitalization has to be considered until the nausea and vomiting can be controlled. Nausea and vomiting, especially in the mornings, is a common symptom in pregnancy. If a Soldier has a positive pregnancy test or symptoms of nausea during pregnancy, she will require a longer-term plan than the minor-care protocol can accommodate."],
  C1DP3 = ["MCP for nausea/vomiting. Handwashing is important to prevent spread of disease. Due to contagion risk, activity modification is important for food handlers and multiple cases or when DFAC food is suspected must be reported to the supervising NCO due to the potential of an outbreak. Diet control is very important in treating nausea and vomiting. Ice chips should be used initially. Once vomiting is controlled, advance to clear liquids (broth, fruit juice, sports drink and caffeine free soda). Start with small sips and slowly advance. Once the Soldier has been able to tolerate liquids for 24 hours, advance to a BRAT (bread, rice, apple sauce, toast) diet of simple carbohydrates. The Soldier with severe or persistent vomiting that is unable to tolerate liquids will require IV fluids. Advise the Soldier to return for medical assistance if the symptoms last more than two days, if blood appears in his vomit or in his stools, or if he becomes dizzy and/or faints upon standing. Vomiting that is severe enough to prevent the Soldier from keeping clear liquids down for 24 hours, severe abdominal pain, or worsening symptoms are also causes for a prompt return visit."],
  C1DP4 = [],
  C1DPRE = ["DP 3. There are many other symptoms that can be associated with nausea and vomiting to include dizziness (vertigo), headaches (migraines) and heartburn. Reflux and regurgitation (return of gastric contents to hypopharynx with little effort) can be seen with heartburn and do not require treatment unless symptomatic."],
  C1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Vomiting blood/coffee grinds and melena can be signs of an intestinal bleed. Neurologic symptoms can be a sign of increased intracranial pressure. Myocardial infarction can present with nausea."],
  C1PRO = ["Hand washing protocol. Special food handler precautions.","Notify supervising NCO if DFAC food is suspected or multiple cases identified.","Initiate a clear liquid diet with broth, sports drinks, clear non-caffeine soft drinks, fruit juice. ice chips to maintain calories and hydration. When vomiting controlled, start BRAT diet of simple carbohydrates.","Return to clinic if not improved in 48 hours or any of the red flags or other symptoms develop."],
  C1LIMITATIONS = ["No food handling, if work in a DFAC, until symptoms have resolved x 48 hours"],
  C1GEN = ["Pg. 51-52: ","Acute diarrhea in adults are often infectious in nature. The largest risk is due to volume depletion secondary to fluid loss. Small intestine infections often results in large, watery bowel movements associated with cramping, bloating, and gas symptoms. Large intestine infections often results in frequent regular, small bowel movements that are painful and associated with symptoms of mucous, blood, or fever. In general, diarrhea is often self-limited. Note that treatment of the symptoms by decreasing bowel movements frequency may extend the length of the disease."],
  C1MEDCOM = ["Administer Antiemetic pg. 67(3)(g)","Obtain Laboratory Specimens pg. 69-70(2)(k)"],
  C1STP1 = ["N/A"],
  C1DDX = ["Medication","Infection","Intense Pain","Pregnancy","Concussion","Heartburn"],

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
  C2GEN = ["Pg. 53-54: ","Acute diarrhea in adults are often infectious in nature. The largest risk is due to volume depletion secondary to fluid loss. Small intestine infections often results in large, watery bowel movements associated with cramping, bloating, and gas symptoms. Large intestine infections often results in frequent regular, small bowel movements that are painful and associated with symptoms of mucous, blood, or fever. In general, diarrhea is often self-limited. Note that treatment of the symptoms by decreasing bowel movements frequency may extend the length of the disease."],
  C2MEDCOM = ["Obtain Laboratory Specimens pg. 69-70 (2)(k)"],
  C2STP1 = [ "Subject Area 2: Medical Treatment. Initiate Treatment for a Poisoned Casualty. 081-833-0004", "Subject Area 6: Primary Care. Provide Treatment for Abdominal Disorders. 081-833-0239", "Subject Area 16: CBRN. Provide Treatment for a Radiation Casualty. 081-833-0280"],
  C2DDX = ["Food Intolerance", "Medication", "Infection (Viral/Bacterial)", "Dizziness", "Chest Pain", "Ear Pain", "Heartburn"],
  
//c3
  C3ACT1 = ["Pregnancy Screen/ Test"],
  C3ACT2 = ["Screen nausea, diarrhea, pelvic pain, constipation, heartburn, urinary Sx, or other symptoms"],
  C3ACT3 = [],
  C3DP1 = ["DP 1. Suspected melena and coffee grind emesis should be tested and referred to a privileged provider if positive."],
  C3DP2 = ["DP 2. Periumbilical pain that moves to the right lower quadrant (RLQ) is a sign of appendicitis. Pancreatitis and appendicitis are often associated with a loss of appetite. Women of childbearing age should have their pregnancy status verified. Abdominal pain in the setting of pregnancy or recent abdominal trauma can signify an underlying issue. Chronic abdominal pain requires further evaluation by a qualified provider. New-onset benign, functional illness in a Soldier 50 plus years old is unlikely and should be evaluated further."],
  C3DP3 = ["MCP for Abdominal Pain. After significant underlying diseases have been ruled out, many causes of abdominal pain are not identified in the acute setting. Gas pain, constipation, stress are some of the potential other causes of the pain. The pain usually resolves on its own. Initial treatment includes hydration and a well-balanced, high fiber diet to help with any potential issues with constipation. A food diary looks for potential triggers. Follow-up if symptoms worsen, red flags, new symptoms, or no improvement in three days."],
  C3DP4 = [],
  C3DPRE = ["DP 3. Abdominal pain frequently accompanies nausea, diarrhea, and constipation. Soldiers should be screened for the complaint. Pelvic pain has an additional partial differential diagnosis and should be screened according to that protocol. Urinary symptoms can progress from a urinary tract infection to a bladder infection causing flank pain."],
  C3DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Unstable vitals represent a significant health risk. Abdominal rigidity and rebound or significant Soldier discomfort with bumping the Soldier’s stretcher/chair are signs of peritonitis and can represent a surgical abdomen. Level of pain may represent the significance of the underlying disease."],
  C3PRO = ["Initiate hydration with 8 glasses of water per day and a well-balanced, high fiber diet.","Maintain a food diary to see if the symptoms are related to a particular food.","Follow-up in 3 days if the symptoms have not resolved or earlier if symptoms worsenn, new symptoms develop, or red flags become present"],
  C3LIMITATIONS = ["No running, jumping, riding in vehicle over uneven terrain"," Aerobic activity at own pace/ distance", "Abdominal training at own intensity/ rep"],
  C3GEN = ["pg. 55-56: ","Abdominal pain is pain between the ribs and groin in the front half of the body. Note that a cardiac problem can cause upper abdominal pain. Pain may be related to the location: right upper quadrant (RUQ) (liver, gallbladder), left upper quadrant (LUQ) (spleen), epigastric (stomach, pancreas, aorta, heart), lower (intestines, urinary tract, hernia, pelvic organs), flank (kidney)."],
  C3MEDCOM = ["Obtain Laboratory Specimens pg. 69-70 (2)(k)"],
  C3STP1 = ["Task Subject Area 6: Primary Care. Provide Treatment for Abdominal Disorders. 081-833-0239"],
  C3DDX = ["MI, AAA","Appendicitis","Pancreatitis, Hepatitis","Heartburn","Ectopic Pregnancy","Testicular Torsion","Pelvic Inflammatory Dis."],

  C4ACT1 = ["FOBT unless unable to obtain stool sample"],
  C4ACT2 = [],
  C4ACT3 = [],
  C4DP1 = ["DP 1. Feeling lightheaded and orthostatic hypotension can be signs of significant blood loss. Hemoccult stool test can identify blood in the stool. Blood only on the outside of the stool or toilet paper is more likely to be from a hemorrhoid or anal fissure. If a stool sample cannot be obtained except by a rectal exam, then refer as “Provider Now” for the rectal exam. If a hemoccult stool test is not available, then Soldiers with blood on the outside of the stool or on the toilet paper only should be considered as negative. Blood mixed in with the stool should be treated as positive. If you are unsure, consider it positive."],
  C4DP2 = ["DP 2. These are symptoms of more concerning disease processes to include cancer with a family history of colon cancer before 45 years old, inflammatory bowel disease, and invasive gastroenteritis."],
  C4DP3 = ["Hemorrhoids are enlarged veins around the rectum that protrude; get rubbed; and/or become painful from inflammation related to a small clot forming within the vein. Hemorrhoids are not dangerous but can be extremely uncomfortable. A Soldier who has a history of hemorrhoids or anal fissure and then develops similar symptoms likely has a recurrence. Soldier should be instructed on avoiding constipation since it is a common cause of hemorrhoids and anal fissures. Most people with itching (and no other symptoms) do not have a serious disease.","MCP for hemorrhoids and anal fissures. To decrease the amount of irritation, the stool needs to be soft. Advise the Soldier to ensure adequate intake of fluids (8 glasses a day), eat foods high in fiber like bran cereal and fresh fruits and vegetables, and spend less than five minutes on the toilet at a time. Increase fiber slowly as too much fiber at once may cause stomach cramping and gas. Tell the Soldier that the area should be kept clean by washing with warm water and blotting (rather than wiping) dry. Sitting in warm water can improve healing. Polyethylene glycol (1st line) or docusate sodium (2nd line) can be used to help keep the stool soft. Hydrocortisone and pramoxine cream (3rd line) can be used if needed for inflammation and pain. Instruct the Soldier in its use and to return for evaluation if the symptoms worsen, new symptoms develop, or symptoms last longer than one week or recurs."],
  C4DP4 = [],
  C4DPRE = [],
  C4DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of hemodynamically significant stomach/ intestinal bleeding."],
  C4PRO = ["Sit in warm water for 30min a day. Wash the area with warm water and blotting dry to keep clean.","Drink 8 glasses of liquid a day and eat foods high in fiber.","Medication: Polyethylene glycol (1st line) or docusate sodium (2nd line) can be used to soften the stool, and hydrocortisone and pramoxine cream (3rd line) can be used if needed for inflammation and pain","Return to clinic if not improved in 1 week, symptoms worsen, or new symptoms develop."],
  C4LIMITATIONS = [],
  C4GEN = ["pg. 57-58: ","Rectal pain, itching, and bleeding are often signs of hemorrhoids or an anal fissure but more serious conditions must be ruled out. Hemorrhoids are enlarged veins around the rectum that protrude; get rubbed; and/or become painful from inflammation related to a small clot forming within the vein. Hemorrhoids are not dangerous but can be extremely uncomfortable. A Soldier who has a history of hemorrhoids or anal fissure and then develops similar symptoms likely has a recurrence. Soldier should be instructed on avoiding constipation since it is a common cause of hemorrhoids and anal fissures. Most people with itching (and no other symptoms) do not have a serious disease."],
  C4MEDCOM = ["N/A"],
  C4STP1 = ["Subject Area 6: Primary Care. Provide Treatment for Abdominal Disorders. 081-833-0239","Subject Area 15: Primary Care. Test a Stool Sample. 081-833-0256"],
  C4DDX = ["Gastrointestinal Bleed","Hemorrhoid/Fissure","IBD","Infection","Cancer"],



  C5ACT1 = ["Screen rectal bleeding or other symptoms if present"],
  C5ACT2 = [],
  C5ACT3 = [],
  C5DP1 = ["DP 2. Rectal bleeding can be a sign of significant internal bleeding that requires further evaluation."],
  C5DP2 = ["The most important step in treating constipation is to alter the diet so that it contains plenty of fiber. Fiber is that part of food which is not absorbed into the body but instead remains in the intestines and absorbs water to form the bulk of the bowel movements. Without proper bulk, the large and small intestines cannot work properly, and this causes constipation. Fiber is present in bran cereal, whole wheat bread, fresh fruits, and vegetables. Ensure that the Soldier is taking adequate water (8 glasses a day).","Laxatives can be used on a one-time basis but should not be used repeatedly because the body can become dependent on them. After the bisacodyl, use polyethylene glycol for two weeks (1st line) or docusate sodium for one week (2nd line) to prevent recurrence. Not everyone has a bowel movement every day. Bowel movements may occur as often as three times a day or once every three days and still be normal. Discomfort and a change in pattern are more reliable guides to a diagnosis of constipation. Instruct the Soldier to return for medical assistance if abdominal pain develops, if the interval between movements is three days or longer, or if blood appears in his or her stool."],
  C5DP3 = [],
  C5DP4 = [],
  C5DPRE = ["DP 2. Rectal bleeding can be a sign of significant internal bleeding that requires further evaluation."],
  C5DPRED = ["DP 1. These are symptoms of hypothyroidism. Soldiers that screen positive for possible hypothyroidism should be referred for further evaluation."],
  C5PRO = ["Counsel the Soldier to drink 8 glasses of water per day and eat foods that are high in fiber","Medication: bisacodyl for acute constipation followed by a polyethylene glycol for 2 weeks (1st line) or docusate sodium for 1 week (2nd line)","Return to clinic for blood in stool, abdominal pain, or not having a BM for 3 days"],
  C5LIMITATIONS = [],
  C5GEN = ["pg. 59-60: ","Constipation means infrequent or difficult bowel movements. Soldiers use the word to mean many things—painful defecation, narrowing of the stools, or not having a “regular daily” bowel movement. Normal bowel habits differ from Soldier to Soldier; therefore, a wide variation exists in what Soldiers consider to be normal or to be a problem.", "Because constipation and hemorrhoids commonly occur together, rectal bleeding may be falsely attributed to these causes. This can be a dangerous mistake. Rectal bleeding must be screened as a separate problem. Constipation not associated with rectal bleeding may be appropriately treated through minor-care."],
  C5MEDCOM = ["N/A"],
  C5STP1 = ["Subject Area 6: Primary Care. Provide Treatment for Abdominal Disorders. 081-833-0239"],
  C5DDX = ["Obstruction","Cancer","Hypothyroidism","Constipation","Associated with Hemorrhoids"],
//C6
  C6ACT1 = ["Include glucagon if unable to transport within 24 hours of onset"],
  C6ACT2 = ["Screen sore throat or other symptoms if present"],
  C6ACT3 = [],
  C6DP1 = ["DP 1. Most common cause of dysphagia in an adult is an acute food obstruction. It is often due to swallowing a piece of meat that has not been fully chewed. Food obstruction will present with a feeling of something stuck in the throat and decreased or inability to swallow. The obstruction must be removed promptly. Complete obstruction should undergo an emergent endoscopy. A partial obstruction should undergo endoscopy within 24 hours. The esophagus can start to ulcerate and the risk of esophageal perforation increases after 24 hours. If endoscopic evaluation/ treatment is not available within 24 hours, see the treatment protocol below."],
  C6DP2 = ["DP 2. Other causes of dysphagia not related to a sore throat should be evaluated by the AEM."],
  C6DP3 = ["Do not administer meat tenderizers to Soldiers with an esophageal food impaction. It could cause serious esophageal injury. Glucagon can be administered to relax the esophagus as an initial attempt for the Soldier to spontaneously pass the food bolus when a referral for an endoscopic evaluation/ treatment is not available.", "Treatment must be prescribed by a supervising privileged provider."],
  C6DP4 = [],
  C6DPRE = ["DP 3. Dysphagia frequently accompanies a severe sore throat. However, MAKE CERTAIN that dysphagia did not precede the sore throat. Causes of dysphagia not associated with a sore throat may require a more extensive evaluation."],
  C6DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” Airway compromise is an emergency. Coughing, choking, or nasal regurgitation when initiating a swallow is a sign of decreased ability to maintain the airway. The Soldier is at risk for aspiration."],
  C6PRO = ["Do not administer meat tenderizers to Soldiers with an esophageal food impaction. It could cause serious esophageal injury. Glucagon can be administered to relax the esophagus as an initial attempt for the Soldier to spontaneously pass the food bolus when a referral for an endoscopic evaluation/ treatment is not available. Treatment must be prescribed by a supervising privileged provider."],
  C6LIMITATIONS = [],
  C6GEN = ["pg. 61-62: Dysphagia means difficulty or pain when swallowing."],
  C6MEDCOM = ["Obtain Laboratory Specimens pg. 69-70 (2)(k)"],
  C6STP1 = [  "Subject Area 6: Primary Care. Perform a HEENT Exam. 081-833-0254"],
  C6DDX = ["Food bolus obstruction","Esophagitis","Ring, Web, Achalasia","Throat Infection"],
//C7
  C7ACT1 = ["Oxygen, EKG, chewable aspirin"],
  C7ACT2 = ["Oxygen, EKG, chewable aspirin"],
  C7ACT3 = [],
  C7DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1. Angina (substernal chest pressure, worse with exercise), shortness of breath, tachycardia, lightheaded, sweating, shoulder or jaw pain can be signs and symptoms of a myocardial infarction. Obtain an EKG and give aspirin (if no signs of bleeding). Do not wait to provide oxygen, give aspirin, and start IV before notifying the supervising privileged provider. Vomiting blood or coffee grinds and melena are signs of a bleeding ulcer. Tearing pain that radiates to the back is a sign of a dissecting aortic aneurysm."],
  C7DP1 = ["Oxygen, EKG, and chewable aspirin","DP 1. Angina (substernal chest pressure, worse with exercise), shortness of breath, tachycardia, lightheaded, sweating, shoulder or jaw pain can be signs and symptoms of a myocardial infarction. Obtain an EKG and give aspirin (if no signs of bleeding). Do not wait to provide oxygen, give aspirin, and start IV before notifying the supervising privileged provider. Vomiting blood or coffee grinds and melena are signs of a bleeding ulcer. Tearing pain that radiates to the back is a sign of a dissecting aortic aneurysm."],
  C7DP2 = ["DP 2. These are symptoms that suggest a more chronic condition than just heartburn. History of an ulcer suggests gastritis or another ulcer. Unexplained weight loss is a sign of cancer. Anorexia and vomiting are signs of pancreatitis. Dysphagia and odynophagia are signs of esophagitis and chronic gastroesophageal reflux disease."],
  C7DP3 =["MCP for gastroesophageal reflux. It occurs due to the passage of gastric contents into the esophagus. It is a normal physiologic process that can result in brief episodes of heartburn. Overeating, tobacco, alcohol, overweight, stress, certain foods can act as triggers to increase the frequency of heartburn.","Instruct Soldier on lifestyle modifications: weight loss if overweight, smoking cessation if indicated, and elevation of head of bed, avoidance of chocolate/caffeine/spicy foods/ alcohol/other foods that exacerbate symptoms. Ranitidine (histamine 2 receptor antagonist) as needed for symptoms. Ranitidine reaches peak of action about 2.5 hours after taking and lasts around 8 hours. Return if symptoms are not controlled with minor-care measures, new symptoms arise, or Soldier is having to take the over the counter medication more than once per week."],
  C7DP4 =[""],
  C7DPRE = ["Soldier without the previous concerning symptoms and classic heartburn symptoms can be treated with over the counter medications and lifestyle changes.","If other symptoms are present, he or she should be screened for those symptoms."],
  C7PRO = ["Medication: Ranitidine as needed (up to 2 doses in 24 hours)","Lifestyle modification: weight loss if indicated, smoking cessation if indicated, elevation of head of bed, avoidance of foods that make it worse.","Return to clinic if any of the red flags or other symptoms develop, not improved with Minor Care Protocol, or taking ranitidine more than once per week on average."],
  C7LIMITATIONS = [],
  C7GEN = ["pg. 63-64: Heartburn is a common finding but can also be a sign of a more serious condition like a gastric ulcer or heart attack."],
  C7MEDCOM = ["Performs 12-lead Electrocardiogram pg. 69-70 (2)(o-p) "],
  C7STP1 = ["Subject Area 12: Medical Treatment. Obtain an Electrocardiogram. 081-833-3007 ","Subject Area 6: Primary Care. Provide Treatment for Abdominal Disorders. 081-833-0239"],
  C7DDX = ["Gastroesophageal Reflux","Myocardial Infarction","Stomach/Duodenal Ulcer","Cancer","Pancreatitis"],


  D1ACT1 = ["Oxygen, EKG, IV"],
  D1ACT2 = ["Oxygen, EKG, IV, Aspirin 325 mg"],
  D1ACT3 = ["DP 3. Identifies conditions that are self-limited or can be treated with a minor-care protocol."],
  D1DP1 = ["DP 1. Tachycardia, sweating, pain or pressure in the chest, shoulder, or jaw can be symptoms of a myocardial infarction. Chest pain and tachycardia can also be signs of a pulmonary embolism. Irregular pulse identifies an arrhythmia. Do not wait to provide oxygen, give aspirin, and start IV before notifying the supervising privileged provider."],
  D1DP2 = ["DP 2. Screens for other medical conditions requiring further evaluation. Productive cough and elevated temperature are signs of pneumonia. Symptoms lasting longer than 10 days may not be viral. History of asthma or wheezing screens for an asthma exacerbation."],
  D1DP3 = ["MCP for cold symptoms: Counsel the Soldier to drink plenty of fluids and rest, cover their mouth when they cough and wash hands to prevent spread. Ibuprofen for pain, acetaminophen for elevated temperature, decongestant for nasal congestion, guaifenesin for mucous, or antihistamine for allergies. Return to clinic if not improving within one week, worsening symptoms, fever, new sinus pain, lightheadedness, or pain in the neck.", "MCP for panic attack symptoms (chest tightness, palpitations, anxious, lightheaded): Check EKG. If EKG is normal, initiate observed deep breathing exercises. Place a pulse oximeter on the Soldier’s finger. Have the Soldier lay back at a 45 degree angle with legs uncrossed and initiate diaphragmatic breathing exercises with deep, slow inhalation over 4 seconds and exhalation over another 4 second count. If the SpO2 starts to drop, disposition the Soldier as “Provider Now”.Refer Soldier to Behavioral Health after initial panic attack decreases in intensity."],
  D1DP4 = ["DP 3. Identifies conditions that are self-limited or can be treated with a minor-care protocol."],
  D1DPRE = [],
  D1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now”. Start the Soldier on oxygen with non-rebreather mask at 10 Liters/ minute, start an IV and IVF at TKO and obtain EKG if available. They can be signs of significant underlying medical problems.","DP 1. Tachycardia, sweating, pain or pressure in the chest, shoulder, or jaw can be symptoms of a myocardial infarction. Chest pain and tachycardia can also be signs of a pulmonary embolism. Irregular pulse identifies an arrhythmia. Do not wait to provide oxygen, give aspirin, and start IV before notifying the supervising privileged provider."],
  D1PRO = ["Cold or allergy symptoms: A-3 Minor Care Protocol ","Panic attack symptoms: Check EKG. Monitor purse oximeter. Supervised deep breathing exercises. Referral to provider now if oxygenation decreases or symptoms do not resolve. Refer to behavioral health after dyspnea symptoms have resolved. "],
  D1LIMITATIONS = ["Cold Symptoms","Aerobic training at own pace/distance x 3 days","Limit exposure to temperatures below <50 degrees F"],
  D1GEN = ["pg. 65-66: Dyspnea is a sensation of breathing discomfort that can be in respiratory or cardiovascular in nature."],
  D1MEDCOM = ["Initiate an Intravenous Infusion pg.69 (2)(a)","Provide Oxygen pg.69 (2)(h)","Performs 12-lead Electrocardiogram pg. 69-70 (2)(o-p)"],
  D1STP1 = ["Subject Area 5: Venipuncture and IV Therapy. Initiate an Intravenous Infusion. 081-833-0033", "Subject Area 6: Primary Care. Provide Care for Common Respiratory Disorders. 081-833-0245"],
  D1DDX = ["Asthma","Anxiety","Myocardial Infarction","Pulmonary Embolism","Pneumonia, Bronchitis","Deconditioning"],

  D2DDX = ["Myocardial Infarction","Pulmonary Embolism","Pneumonia, Bronchitis","Anxiety","Heartburn","Musculoskeletal"],
  D2ACT1 = ["Oxygen, EKG, IV, Aspirin 325 mg"],
  D2ACT2 = ["Oxygen, EKG, IV, Aspirin 325 mg"],
  D2ACT3 = [],
  D2DP1 = ["DP 2. Elevated temperature and productive cough screens for pneumonia. Recent chest trauma screens for multiple etiologies to include a rib fracture."],
  D2DP2 = ["DP 3. Conditions that are not identified below should be referred to the AEM for further evaluation."],
  D2DP3 = ["MCP for cold symptoms. See Protocol A-3.","MCP for panic attack symptoms (chest tightness, palpitations, anxious, lightheaded): Check EKG. If EKG is normal, initiate observed deep breathing exercises. Place a pulse oximeter on the Soldier’s finger. Have the Soldier lay back at a 45 degree angle with legs uncrossed and initiate diaphragmatic breathing exercises with deep, slow inhalation over 4 seconds and exhalation over another 4 second count. If the SpO2 starts to drop, disposition the Soldier as “Provider Now”. Refer Soldier to behavioral health after initial panic attack decreases in intensity.","MCP for musculoskeletal chest pain: Pain must be reproducible and directly correspond to a supporting history. Medications: ibuprofen as needed for muscle complaints. Return to clinic if pain increases, lasts longer than three days, shortness of breath/ dizziness/ or new symptoms develop. ","Must discuss with supervising privileged provider before Soldier leaves screening area."],
  D2DP4 = [],
  D2DPRE = [],
  D2DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now”. Start them on oxygen with a nasal cannula at four-six liters/ minute, start an IV and IVF at TKO, give a chewable aspirin. These can be signs of significant underlying medical problems.","DP 1. Obtain an EKG if available. Tachycardia, sweating, pain, and pressure in the chest, shoulder, or jaw can be symptoms of a myocardial infarction. Note that diabetics and women can present atypically. Chest pain and tachycardia can also be signs of a pulmonary embolism or arrhythmia. Do not wait to provide oxygen, give aspirin, and start IV before notifying the supervising privileged provider."],
  D2PRO = ["Must discuss with supervising privileged provider before Soldier leaves screening area","Cold liky symptoms: A-3 Protocol","Hearburn: C-7 Protocol","Panic attack symptoms: Check EKG. Monitor pulse oximeter. Supervised deep breathing exercises. Referral to provider now if oxygenation decreases or symptoms do not resolve. Refer to behavioral health after dyspnea symptoms have resolved","Musculoskeletal: Medications: ibuprofen or acetaminophen for pain, analgesic balm for muscle/tendons. Temporary profile x 3 days if needed. Return to the clinic if pain increases, not improved in four days, shortness of breath/dizziness/or new symptoms develop."],
  D2LIMITATIONS = ["MSK Chest Pain: May lift, push up to 25 lbs","Cold Symptoms: Aerobic training at own pace/distance x 3 days","Limit exposure to temperatures below <50 degrees F"],
  D2GEN = ["pg. 67-68: Chest pain must always be taken seriously. It is a sign of many serious conditions."],
  D2MEDCOM = ["Initiate an Intravenous Infusion pg.69(2)(a)","Provide Oxygen pg.69(2)(h)","Performs 12-lead Electrocardiogram pg. 69-70(2)(o-p)"],
  D2STP1 = ["Subject Area 12: Medical Treatment. Obtain an Electrocardiogram 081-833-3007","Subject Area 4: Airway Management. Administer Oxygen 081-833-0158"],

  E1ACT1 = ["UA, urine culture if available"],
  E1ACT2 = ["UA, Urine culture"],
  E1ACT3 = [],
  E1DP1 = ["DP 2. Urinary complaints in a male are more likely to be something other than a urinary tract infection. Recurrent urinary tract infections (UTIs), recent urinary catheterization, and immunocompromised are more likely to have an atypical bacterial infection."],
  E1DP2 = ["UA and urine culture should be completed if resources are available. A Soldier with symptoms consistent with a UTI can be empirically treated without a urinalysis after ruling out any history that would increase the Soldier’s risk and determining any allergies to medications.","MCP for UTI. Instruct the Soldier about the importance of increasing fluid intake to flush out the bacteria. OTC medication: phenazopyridine as needed for pain. Instruct the Soldier that it will likely dye his or her urine orange. It may also stain contact lenses from transferring the dye from the fingers to the contacts, if worn. Antibiotics: Trimethoprim/ Sulfamethoxazole is the first line agent. Nitrofurantoin is the second line agent if the Soldier is allergic to sulfa drugs or there is local resistance to the first line agent. Return to clinic if symptoms are not improving within 24 hours, development of new symptoms, or worsening symptoms despite treatment."],
  E1DP3 = ["MCP for UTI. Instruct the Soldier about the importance of increasing fluid intake to flush out the bacteria. OTC medication: phenazopyridine as needed for pain. Instruct the Soldier that it will likely dye his or her urine orange. It may also stain contact lenses from transferring the dye from the fingers to the contacts, if worn. Antibiotics: Trimethoprim/ Sulfamethoxazole is the first line agent. Nitrofurantoin is the second line agent if the Soldier is allergic to sulfa drugs or there is local resistance to the first line agent. Return to clinic if symptoms are not improving within 24 hours, development of new symptoms, or worsening symptoms despite treatment."],
  E1DP4 = [],
  E1DPRE = [],
  E1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems.","DP 1. Urinary tract infections can get worse if not promptly treated. Urinary tract infection can progress to a kidney infection and then a systemic infection through the blood. Uncontrolled diabetes can present with increased urination and nausea with vomiting. Complaints requiring an invasive exam are referred to the supervising privileged provider."],
  E1PRO = ["UTI: drink 8+ glasses of water/day. Phenazopyridine as needed. Counsel on it changing urine orange and potential to dye contacts. ","First line agent: trimethoprim/sulfamethoxazole. if the MTF antibiotic resistance is greater than 20% or patient has sulfa allergy, use second line agent. ","Second line agent: nitrofurantoin, if the patient reports an allergy to nitrofurantoin. refer to AEM. ","Return to clinic if symptoms not improving within 24 hours, development of new symptoms, worsening symptoms "],
  E1LIMITATIONS = [],
  E1GEN = ["pg. 69-70: Painful urination is most commonly a sign of a urinary tract infection, kidney stone, sexually transmitted infection, or yeast infection. Frequent urination can be associated with these but can also be one of the initial signs of hyperglycemia from diabetes. ","UA and urine culture should be completed if resources are available. A Soldier with symptoms consistent with a UTI can be empirically treated without a urinalysis after ruling out any history that would increase the Soldier’s risk and determining any allergies to medications."],
  E1MEDCOM = ["Obtain Laboratory Specimens pg. 69-70(2)(k)"],
  E1STP1 = [],
  E1DDX = ["Kidney Infection","Urinary Tract Infection","Kidney Stone","Uncontrolled Diabetes","BPH","STI, Vaginitis"],
  E2DDX = ["Testicular Torsion","Hernia","Muscle/Tendon Strain","Stress Fracture","Hip injury"],
  E2ACT1 = ["Stress fracture: crutches with toe touching weight bearing"],
  E2ACT2 = ["STD Screen and UA"],
  E2ACT3 = ["STD Screen and UA"],
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
  E4LIMITATIONS = ["For incontinence: Access to a restroom, No jumping"],
  E4GEN = ["pg. 75-76: ","Problems with voiding may include urinary incontinence (voiding unintentionally), difficulty initiating the urinary stream, decreased force of the stream, dribbling urination, complete inability to void."],
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
  F1GEN = ["pg. 77-78: ","It is useful to try and distinguish among different presentations of dizziness: faintness, blackouts, vertigo, confusion, malaise, muscle weakness, and other sensations. True vertigo refers to an illusion where the room seems to be spinning about or the floor seems to be moving. It may be likened to the feeling experienced immediately after getting off a fast merry-go-round and is often accompanied by nausea. Faintness or light-headedness is a feeling of unsteadiness or beginning to fall. Blackout refers to a complete loss of consciousness and observers should also be questioned about potential causes of the event and any unusual observations during the event."],
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
  F2GEN = ["pg. 79-80: ","In the absence of fever, severe pain, or confusion, serious disease is extremely unlikely. Migraines often present with a gradual, increasing onset of a one sided, pulsatile moderate to severe headache worse with physical activity, noise, or light and associated with nausea and may have an aura. Tension-type headache often presents as a bilateral pressure that waxes and wanes lasting from 30 min to seven days. Cluster headache is rare. It presents with a rapid onset within minutes of unilateral deep, continuous severe pain around the eye or temple often associated with tearing, congestion, runny nose, pallor, or sweating."],
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
  F3GEN = ["pg. 81-82: ","“Numbness” may be used by the Soldier to describe muscle weakness, malaise, confusion, or abnormal sensation including tingling (a “pins and needles” sensation). Paralysis/weakness is a condition that refers to a loss of muscular strength resulting in difficulty or inability to move a body part. A complete loss of muscular strength is paralysis; a partial loss is weakness."],
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
  F5GEN = ["pg. 85-86: ","The terms “depression, nervousness, anxiety, tension” and complaints of “nerves” or “being upset” may all be used by Soldiers to describe problems with mood. Complaints such as these are often due to situational or behavioral health factors, but may also be due to a physical condition. Everyone experiences emotional distress from time to time. However, when symptoms become continuous or interfere with daily functioning, or when suicidal or homicidal thoughts or self-harm are reported, the complaint must be taken seriously and further evaluated."],
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
  F6GEN = ["pg. 87-89: ","More information is available at https://dvbic.dcoe.mil. minor traumatic brain injury (mTBI) or concussion is an injury to the brain that may result after blunt force, an acceleration/deceleration head injury (whiplash), or exposure to a blast wave (close contact or prolonged duration such as a firing range). In addition, mild TBIs are defined by at least one of the following clinical signs immediately following the event: alteration of consciousness lasting <24 hours, loss of consciousness <30 minutes, or post-traumatic amnesia <24 hours. CT scans are not indicated for most patients with concussion, but if obtained, the results are typically normal."],
  F6MEDCOM = ["N/A"],
  F6STP1 = ["Subject Area 6: Primary Care. Perform a Military Acute Concussion Evaluation 2 (MACE 2) Screening for mild Traumatic Brain Injury 081-833-0247"],

  G1ACT1 = [],
  G1ACT2 = [],
  G1ACT3 = [],
  G1DP1 = ["MCP for fatigue. Advise the Soldier that vitamins are rarely helpful, that “pep pills” do not work (the rebound usually makes the problem worse), and that tranquilizers generally intensify fatigue. Taking a vacation, if possible, or undertaking new activities are often helpful.","Helpful Actions Include: Identifying potential sources of the fatigue such as work stress, marital discord, lack of rest or sleep (either quantity or quality of sleep), or a poor/not well balanced diet. Provide information on proper sleep hygiene and refer to sleep hygiene course if locally available. If not a suicidal risk (which would require immediate referral) suggest various available options for counseling, including behavioral health, Army community services, and the chaplain. Work on the problem rather than on the symptom.","Seek medical assistance if symptoms worsen, other symptoms develop, fatigue makes normal activities difficult, difficulty staying awake while driving, or not improved within one week.","MCP for sleep problems. Sleep issues can present as fatigue described as weakness. It can be a manifestation of depression or stress among other things. Provide education on sleep hygiene, consider providing diphenhydramine or melatonin nightly for three nights, consider activity modification, discuss stress management, and offer a routine referral to behavioral health asset for counseling and treatment."],
  G1DP2 = [],
  G1DP3 = [],
  G1DP4 = [],
  G1DPRE = ["DP 2. If the Soldier has other specific complaints or symptoms, the Soldier should be evaluated for that complaint. Otherwise, the minor-care protocol is appropriate."],
  G1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of medical emergencies.","DP 1. While fatigue is often not caused by a specific disease, it may be a presenting symptom of a potentially serious condition. Depression may only present as fatigue. Decreased libido could be a sign of an adrenal/pituitary issue. Weight change could represent hypo/hyperthyroidism. Menorrhagia often results in anemia. Snoring can be a sign of sleep apnea. USPSTF Screening/PHA is to look at age appropriate cancer and cardiovascular screening. Infections, inflammation, liver/kidney disease, and medication/drug use can also cause fatigue."],
  G1PRO = ["OTC Medication: diphenhydramine to assist with sleep if needed","Referral: Wellness Center for relaxation exercises for stress, ACS for anger management, Behavioral Health or Chaplain for stress or support","Return if not improving in 1 week or immediately if Red Flags, development of new symptoms, or inability to perform daily activ ties."],
  G1LIMITATIONS = ["Allow for 8 hours of uninterrupted sleep with a 24 hour period"],
  G1GEN = ["pg. 90-91: ","Fatigue is a state of increased demand/stress on the body or decreased efficiency."],
  G1MEDCOM = ["N/A"],
  G1STP1 = ["N/A"],

  G2ACT1 = [],
  G2ACT2 = [],
  G2ACT3 = [],
  G2DP1 = ["DP 1. If the Soldier’s temperature is greater than 100.4°F, has symptoms for more than 48 hours, HIV infection, or immunosuppression, then there is a greater risk of the fever being caused by a bacterial infection. Overseas travel, tick or mosquito bite, animal exposure, and malaria endemic area, increase the risk of a zoonotic or malaria infection. IV drug use increases the risk of endocarditis."],
  G2DP2 = ["MCP for elevated temperature. Instruct the Soldier to stay well hydrated and get plenty of rest. He or she should drink fluids to keep their urine mostly clear and obtain at least eight hours of rest per day. Take acetaminophen as needed for temperature above 98.4°F (No more than eight tablets within 24 hours. No other medications with acetaminophen in them. No alcohol.)","Soldier is contagious while he or she has an elevated temperature. He or she should avoid contact with healthy Soldiers as much as possible. If in training, refer to local SOP. Soldier may need to be placed in quarters. Return for medical assistance if symptoms do not improve with acetaminophen, other symptoms develop, or a fever develops (T > 100.4)."],
  G2DP3 = [],
  G2DP4 = [],
  G2DPRE = ["DP 2. Before assuming the Soldier has isolated fever/chills, be sure to ask him/her specifically about other symptoms such as upper respiratory infection symptoms, cough, sore throat, ear pain, diarrhea, dysuria, rash, and muscle aches. If no associated symptoms can be identified, over half of Soldiers’ fever will resolve on its own without an underlying issue being identified."],
  G2DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of medical emergencies."],
  G2PRO = ["OTC Medication: acetaminophen as needed for elevated temperature (No other medications with acetaminophen. No alcohol.), ibuprofen as needed for malaise.","Stay hydrated by drinking fluids to keep your urine mostly clear. Get plenty of rest.","Return if red flags, new symptoms. lasts longer than 48 hours, or fever not controlled with acetaminophen"],
  G2LIMITATIONS = ["For a Fever: Consider Quarters x 24-48 hours (must discuss with supervising privileged provider)"],
  G2GEN = ["pg. 92-93: ","Fever/chills are usually associated with an acute illness with other obvious symptoms."],
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
  J1DP1 = ["DP 1: Skin rash associated with a medication, fever, or is painful (but not due to a sunburn) has the potential to be very serious. Further evaluation is indicated when it has failed previous treatment or is worsening. Certain anatomical locations present with a higher risk of complications to include the face, genitals area, or inhibiting a joint function."],
  J1DP2 = ["DP 2: Change in a lesion or oozing of fluids require further evaluation. Skin lesions that have been present for over 4 weeks may represent a symptom of a systemic condition."],
  J1DP3 = ["MCP for unidentified skin disorder. If the Soldier is already on a treatment for this issue, has not finished the current treatment, and the issue is not getting worse, then instruct the Soldier to continue with the current treatment for the full course. Some skin issues can take two to three weeks or potentially longer for them to work. Confirm with your supervising NCO or supervising privileged provider before returning the Soldier to work. If you recognize the skin lesion, then screen according to the identified skin condition. If you do not recognize the skin lesion, refer the Soldier to the AEM for further evaluation."],
  J1DP4 = [],
  J1DPRE = [],
  J1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems."],
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
  J7ACT3 = ["Perform potassium hydroxide (KOH) examination"],
  J7DP1 = ["DP 1. Diabetes can affect every part of the body, including the skin. Soldiers with diabetes are more susceptible to skin conditions such as bacterial infections and fungal infections. Although common infections can be self-treated, the Soldier should see a privileged provider to rule out other more serious diabetic related skin conditions."],
  J7DP2 = ["DP 2. Some infections and rashes do not respond well to OTC medications and infections may not get better or may reoccur within a few weeks. These Soldiers need to be evaluated to rule out more serious skin conditions. A normal infection may respond better to a prescription strength antifungal.","Note: In the absence of any of the preceding conditions, minor-care is appropriate."],
  J7DP3 = ["MCP for jock itch. Tinea cruris is far more common in men than women. Predisposing factors include copious sweating, obesity, diabetes, and immunodeficiency.","OTC medication. Topical antifungal medication twice a day for two weeks. Instruct Soldier to keep groin area clean and dry and return to clinic if symptoms worsens, new symptoms develop, symptoms not improving within two weeks, or if the infection returns within a few weeks after using OTC Medications."],
  J7DP4 = [],
  J7DPRE = [],
  J7DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.”"],
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
  J9DP1 = ["DP 1: Pilonidal abscesses (over the tail bone) can be much larger than they appear and should be referred to a privileged provider for evaluation. Systemic inflammatory response syndrome (SIRS) criteria, fever, black eschar, rapid progression over hours, and worsening on oral antibiotics are signs of a more significant infection that may require hospitalization. Hand infection, infection over a joint, indwelling medical device, and associated cellulitis increases the risks of serious complications."],
  J9DP2 = ["DP 2: An abscess should be drained to allow it to heal, and an abscess with a diameter of greater than 5 cm will need to be packed. Military population is at risk for community transmission of staphylococcus aureus and should be evaluated for the addition of antibiotic therapy."],
  J9DP3 = ["MCP for skin infection. Prior to abscess formation, the skin normally becomes indurated from the inflammation. The skin appears to be warm, red, and tender with a hard area where the inflammation is present. Treatment is minor-care. An abscess may form within a couple of days requiring further treatment.","Apply a moist, warm compress over the area for 20 minutes every four hours. It will increase blood flow to the area, allowing the Soldier’s immune system to fight the infection. Instruct the Soldier to return to the clinic after the abscess forms for drainage. Return sooner, if symptoms worsen (for example, fevers, chills, increased pain or redness, red streaks, increased swelling, or re-accumulation of pus, if it has already drained)."],
  J9DP4 = [],
  J9DPRE = [],
  J9DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems."],
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

  K1ACT1 = ["1. Ice sheets/douse the patient with water","2. Start an IV as ordered by the doctor or PA","3. Monitor rectal temperature","4. Transport to emergency treatment area"],
  K1ACT2 = ["1. Ice sheets/douse the patient with water","2. Start an IV as ordered by the doctor or PA","3. Monitor rectal temperature","4. Transport to emergency treatment area"],
  K1ACT3 = [],
  K1DP1 = ["DP 1. A “yes” response to any of the questions may indicate heatstroke with a breakdown of the body’s heat regulating mechanism. Heatstroke is characterized by high body temperature (>l03oF), altered mental status (that is, confusion, delirium, syncope and/or coma) and, in most cases, an absence of sweating. This condition has a high mortality rate and is a MEDICAL EMERGENCY. Lowering the body temperature is the most important treatment. Placing icepacks/ice sheets in the groin, arm pits and behind the neck, along with ice sheers under and on top the Soldier allows for rapid cooling. An alternative is dousing the Soldier with water and gently fanning to allow for evaporative cooling. Start an intravenous infusion. Monitor the Soldier’s body (rectal) temperature. Transport to an emergency treatment location, if available."],
  K1DP2 = ["DP 2. A “yes” response to questions may indicate heat exhaustion which occurs as a result of an excessive loss of water and salt from the body. The syndrome is characterized by profuse perspiration, pallor, and perhaps low blood pressure. The mortality rate from this disorder, if treated, is extremely low. Moving the Soldier to a cool area for rest and the administration of fluids (orally or intravenous infusion, depending on severity of symptoms) will result in prompt recovery. Untreated heat exhaustion may progress to heatstroke.","DP 3. A “yes” response to these questions indicates heat cramps. These are painful cramps of voluntary muscles which result from excessive loss of salt from the body. Muscles of the extremities and the abdominal wall are usually involved. Body temperature is normal. Heat cramps can be promptly relieved by replacing salt and fluid orally and placing the individual in a cool environment."],
  K1DP3 = ["MCP for mild heat injury. COOL: Place the Soldier in a cool or shaded place. HYDRATE: Give the Soldier at least one liter of cool water to drink in the first 30 minutes and then at least one liter of water per hour the next 2 hours. Advise the Soldier to decrease his activity for the next 24 hours. REASSESS: If the Soldier’s symptoms do not begin to resolve themselves within 30 minutes, if they get worse, or if the Soldier’s temperature exceeds 100.3OF, refer the Soldier to the supervising privileged provider."],
  K1DP4 = [],
  K1DPRE = [],
  K1DPRED = ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems."],
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
  K5PRO = ["Cover affected skin area. Apply moisturizing lotion to affected area. Apply petroleum jelly or lip balm to the lips, if needed.","RTC if symptoms are worsning, signs of infection, or new symptoms develop."],
  K5LIMITATIONS = [],
  K5GEN = ["pg. 155: Frostbite results from the skin (usually on the toes, fingers, or face) being exposed to extreme cold for an extended period of time. Lower temperatures and high winds result in shorter times to injury. Immediate evaluation is required."],
  K5MEDCOM = ["N/A"],
  K5STP1 = ["N/A"],

  K6ACT1 = [],
  K6ACT2 = [],
  K6ACT3 = [],
  K6DP1 = ["MCP for lice. Wash clothes, sleeping linens, sleeping bag in hot water (above 149oF) or have them dry cleaned. If unable to wash or dry clean, place in a sealed bag for two weeks.","MCP for body lice. Lice live on the seams of the clothing. Permethrin 5% application can also be used in addition to laundering the clothes.","MCP for head lice. Wash the area without using conditioner and towel dry. Apply permethrin cream to saturate the affected area. Leave on for 10 minutes. Rinse with warm (not hot) water. Use a close toothed comb to remove nits (eggs from base of hair follicles). Repeat in one week if nits or lice are still present.","MCP for pubis lice (such as, crabs). Screen for other STIs. Treat recent sexual contacts at the same time. Skin should be cool and dry. Apply Permethrin cream to all affected areas (groin, buttock, thighs, trunk, and axillae) for 10 minutes and then rinse off in warm water. Remove nits with tweezers or thin toothed comb. Follow-up in 10 days. If unable to follow-up, retreat with Permethrin cream in 10 days due to 40% of Soldiers not having cleared the infection with one treatment."],
  K6DP2 = [],
  K6DP3 = [],
  K6DP4 = [],
  K6DPRE = [],
  K6DPRED = ["DP 1: Secondary infection is common due associated itching. If nits and lice are not seen, then further evaluation is needed for a different diagnosis (contact dermatitis or scabies)."],
  K6PRO = ["Launder clothes and bed linens in hot water. ","Body lice: apply perrnethrin 5% cream to body. ","Head lice: wash hair without conditioner and towel dry. Apply permethrin 1% cream. Leave on for 10 minutes. Rinse with warm water. Remove nits and dead lice with thin toothed comb. ","Pubis lice: screen for other STDs. Treat sexual partners at same time. Apply petrnethrin 1% cream to cool, dry areas (groin, buttock, upper thighs, trunk, axillae) for 10 minutes. Rinse with warm water. ","Follow-up in 10 days for repeat evaluation."],
  K6LIMITATIONS = [],
  K6GEN = ["pg. 156-157: Crabs/lice are tiny insects that are visible to the naked eye that infest the hairy areas of the body (such as, groin, body hair, and scalp). The insect deposits eggs (nits) and attaches them at the bases of hair shafts. The lice require a diet of human blood and will die within three days after removal from the body. The possibility of spreading infection to close associates by intimate contact or common use of clothing, beds, or toilet articles is real."],
  K6MEDCOM = ["Administer Topical Ointment/Lotions pg.67(3)(a)","All Medication Protocols Associated with 68W Training And Certifications pg.68(k)"],
  K6STP1 = ["Subject Area 6: Primary Care. Treat Skin Disorders 081-833-0125","Subject Area 18: Medication Administration. Administer Topical Medications 081-833-3020"],

  K7ACT1 = ["Epi pen if indicated"],
  K7ACT2 = ["Epi pen if indicated"],
  K7ACT3 = [],
  K7DP1 = ["DP 1: Red flags, hives, or history of severe reaction from similar insect bite (such as, bee sting allergy), have Soldier inject epinephrine pen if indicated (signs of respiratory or circulatory compromise) and refer to a privileged provider immediately. Reported poisonous insect bite (brown recluse, black widow, etc.) should also be immediately referred."],
  K7DP2 = ["DP 2: If no signs of an insect bite can be seen, a blister or ulcer is present, or there is moderate to severe pain, refer to the AEM for further evaluation because it may be something other than an insect bite."],
  K7DP3 = ["MCP for Insect Bite. Remove any stinger, head of tick, or other biting apparatus left at the bite site. Clean with betadine solution.","Apply Calamine lotion or hydrocortisone 1% cream four times per day as needed for itching. Apply cold compress or ice pack as needed for swelling.","Return to clinic if symptoms worsen, new symptoms develop, or symptoms are not improving within 48 hours."],
  K7DP4 = [],
  K7DPRE = [],
  K7DPRED = ["Red Flags. Wheezing, shortness of breath: immediately disposition the Soldier as “Provider Now.” These can be signs of significant underlying medical problems."],
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
  L9DP2 = ["Fill out paper","Provider review and sign"],
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
  L10DP2 = ["DP 2: Soldiers who are requesting assistance with weight control that is a new issue should be provided information on community resources that are available which may include the Wellness Center, access to a Dietician, an Athletic Trainer, or Strength and Conditioning Coach and offered a referral to Integrated Behavioral Health if available."],
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
  L11DP2 = ["Screen symptoms"],
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
  M1DP2 = ["DP 2: Soldier should not be screened to below the AEM level when he or she returns to the clinic for the same issue that was previously treated with minor-care. Soldier has the option to elevate his or her disposition to the next higher level (Provider Now) if he or she feels uncomfortable with seeing an AEM."],
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
  M2DP2 = ["DP 2: If possible, refer the Soldier to the original privileged provider. If the original privileged provider is not available, discuss the situation with the AEM. Based on local policy and original privileged provider availability, the Soldier may be scheduled with a different privileged provider that is covering for the original privileged provider or scheduled with the original privileged provider when he or she is next available. Explain to the Soldier when his or her follow-up will be."],
  M2DP3 = [],
  M2DP4 = [],
  M2DPRE = [],
  M2DPRED = ["DP 1: Rescreen the Soldier if he or she appears acutely ill. Refer to the supervising privileged provider if he or she is worsening, not improving, or screen as “Provider Now” in the protocol."],
  M2PRO = [],
  M2LIMITATIONS = [],
  M2GEN = ["pg. 176: Many Soldiers are told to return for follow up. Write the previous level of care and name of the privileged provider on the screening note."],
  M2MEDCOM = ["Subject Area 1: Vital Signs. Measure a Patient’s Blood Pressure 081-833-0012"],
  M2STP1 = ["N/A"],
  E3DDX = ["Testicular Torsion","Hernia","Muscle/Tendon Strain","Stress Fracture","Hip injury"],
E4DDX = ["Urinary Obstruction","Benign Prostatic Hypertrophy","UTI, STI","Stress Incontinence"],
F1DDX = ["Orthostatic Hypotension","Vasovagal Syncope","Vertigo","Anxiety","Heart Arrhythmia","Intracranial Bleed","Seizure, Drugs, Alcohol"],
F2DDX = ["Migraine Headache","Tension Headache","Caffeine Withdrawal","Infection/Meningitis","Intracranial Hemorrhage"],
F3DDX = ["Viral Syndrome/ Fatigue","Stroke","Nerve Compression","Hypoglycemia","Hyperventilation","Depression","Lyme disease"],
F4DDX = ["Hypoglycemia","Hypotension","Hypoxia","Concussion","Infection","Intoxication"],
F5DDX = ["Depression","Anxiety","Hypoxia","Hypo/hyperthyroidism","Substance intoxication or withdrawal"],
F6DDX = ["Headache/migraine","Concussion","Intracerebral Hemorrhage","Anxiety","Stroke","Spinal cord injury","Seizure","Dehydration"],
G1DDX = ["Sleep Debt","Sleep Apnea","Anemia","Anxiety Disorders","Chronic Infection/Inflammation","Chronic fatigue syndrome","Acute liver failure"],
G2DDX = ["Malaise","Cold Symptoms","Sore Throat, Ear Pain","Heat/Cold Injury","Diarrhea","Pain with urination"],
H1DDX = ["Blepharitis","Allergies","Conjunctivitis","Corneal Abrasion/Trauma","Subconjunctival Hemorrhage","Keratitis/Iritis"],
H2DDX = ["Stye, Blepharitis","Dermatitis","Infection","Eyelid laceration"],
H3DDX = ["Trauma","Migraine","Hemorrhage","Infection","Ischemia, Stroke"],
H4DDX = ["Intoxication","Prescription Eyeglasses","Muscle Weakness","Trauma"],
I1DDX = ["Cyclical Breast Pain","Musculoskeletal Issue","Large Breasts","Mastitis, Abscess","Cancer"],
I2DDX = ["Irregular Menstrual Cycle","Pregnancy"],
I3DDX = ["Heavy Menstrual Cycle","Irregular Menstrual Cycle","Birth Control Side Effect","Miscarriage","Ectopic Pregnancy"],
I4DDX = ["Bacterial Vaginosis","Yeast Infection","Trichomonas","Pelvic Inflammatory Disease","STI"],
I5DDX = ["N/A"],
I6DDX = ["N/A"],
J1DDX = ["Eczema","Hives","Contact Dermatitis","Athlete’s Foot","Heat Rash","Drug Reaction"],
J2DDX = ["Acne Vulgaris","Pseudofolliculitis Barbae","Folliculitis","Acne Rosacea","Hyperandrogenism"],
J3DDX = ["Acne","Pseudofolliculitis Barbae","Folliculitis","Tinea Barbae","Acne Keloidalis Nuchae"],
J4DDX = ["Pemphigus Foliaceous","Tinea Capitis","Psoriasis","Allergic Contact Dermatitis","Seborrheic Dermatitis"],
J5DDX = ["Alopecia","Traction Hair Loss","Alopecia Areata","Tinea Capitis","Acne Keloidalis Nuchae"],
J6DDX = ["Interdigital tinea pedis","Hyperkeratotic (moccasin-type) tinea pedis","Vesiculobullous (Inflammatory) tinea pedis"],
J7DDX = ["Inverse psoriasis","Erythrasma","Seborrheic dermatitis","Candidal intertrigo"],
J8DDX = ["Seborrheic dermatitis","Tinea corporis","Vitiligo","Secondary syphilis"],
J9DDX = ["Folliculitis","Abscess","Epidermal Cyst","Hidradenitis Suppurativa","Septic Joint"],
J10DDX = ["Cold Sore","Aphthous Ulcer","Epstein-Barr Virus","Syphilis"],
J11DDX = ["Abrasion","Laceration"],
J12DDX = ["N/A"],
J13DDX = ["Hives","Contact Dermatitis","Viral Exanthem","Drug Rash"],
J14DDX = ["Burn","Irritant Contact Dermatitis"],
J15DDX = ["Corn","Stephen Johnson Syndrome","Staphylococcal scalded skin syndrome"],
J16DDX = ["Callus","Plantar Wart","Corn","Bunion"],
J17DDX = ["Cutaneous Wart","Corn","Callous","Skin Cancer"],
J18DDX = ["Paronychia","Ingrown Toenail","Trauma","Cellulitis"],
K1DDX = ["Heatstroke","Heat Cramps","Heat Exhaustion","Fever/ Infection","Dehydration","Hyperthyroidism"],
K2DDX = ["Environmental Exposure","Exhaustion and Malnutrition","Hypothyroidism","Sepsis"],
K3DDX = ["Nonfreezing Cold Injury","Cold Urticaria","Raynaud Phenomenon","Frostbite"],
K4DDX = ["N/A"],
K5DDX = ["N/A"],
K6DDX = ["Lice","Scabies","Contact Dermatitis","Fungal Infection","Hair Casts"],
K7DDX = ["Insect Bite","Skin Infection","Contact Dermatitis"],
L1DDX = ["Low Risk Exposure","High Risk Exposure"],
L2DDX = ["Tooth Cavity","Poor Dental Hygiene","Temporomandibular Joint Pain","Infection","Heart Attack"],
L3DDX = ["Aphthous Ulcers","Herpes Simplex Virus","Hand, Foot, and Mouth Disease","Stevens Johnson Syndrome"],
L4DDX = ["N/A"],
L5DDX = ["N/A"],
L6DDX = ["N/A"],
L7DDX = ["N/A"],
L8DDX = ["N/A"],
L9DDX = ["N/A"],
L10DDX = ["N/A"],
L11DDX = ["N/A"],
L12DDX = ["N/A"],
M1DDX = ["N/A"],
M2DDX = ["N/A"],
A1FLAG = ["SOB", "Stridor", "Deviated Uvula", "Drooling/ Trouble Swallowing ", "Stiff Neck"],
A2FLAG = ["Stiff Neck AND Fever", "Posterior ear pain and/or mastoid erythema"],
A3FLAG = ["Abnormal Vital Signs","Shortness of Breath","Stiff Neck","Altered Mental Status","Coughing up blood clots or frank blood"],
A4FLAG = ["Altered Mental Status","Focal Neurological Symptom or Sign","Dizziness"],
A5FLAG = ["Airway Compromise","Orthostatic Hypotension","Bleeding from Gums","Inability to Move Eye"],
B1FLAG = ["Fever", "Saddle Anesthesia", "Urinary Retention/", "Incontinence Fecal Incontinence", " Motor Deficits", "Trauma with Vertebral Tenderness or Neuropathy", "Dysuria/Frequency", "Chest/Abdominal Pain"],
B2FLAG = ["Bony step off/midline", "tenderness to palpation", "Inability to flex neck","Fever", "Recent HEENT or dental", "infection"],
B3FLAG = ["Distal Pulses Abnormal", "Distal Sensation Abnormal", "Deformity", "Cardiac Symptoms"],
B4FLAG = ["Distal Pulses Abnormal","Distal Sensation Abnormal","Deformity"],
B5FLAG = ["Distal Pulses Abnormal", "Distal Sensation Abnormal", "Deformity", "Open Fracture"],
B6FLAG = ["Abnormal Capillary Refill","Abnormal Distal Sensation","Palmar Infection","Deformity","Significant Burn"],
B7FLAG = ["Abnormal PMS", "Deformity", "High Energy Trauma", "Suspect Stress Fracture (increased with weight bearing or during exercise, endurance training, change in exercise routine)" ,"Severe Pain"],
B8FLAG = ["Abnormal PMS", "Deformity", "High Energy Trauma"],
B9FLAG = ["Abnormal Distal Pulse", "Abnormal Sensation", "Deformity"],
B10FLAG = ["Abnormal Distal Pulse", "Abnormal Sensation", "Deformity", "Suspect Stress Fracture (increased with weight bearing or during exercise, endurance training, change in exercise routine)"],
B11FLAG = ["Abnormal Distal Pulse", "Abnormal Sensation", "Deformity", "Cola Colored Urine", "Inability to Urinate"],
C1FLAG = ["Vomiting Blood or Coffee Grinds, Melena","Neurologic Symptoms","Chest Pain","Abdominal Pain followed by Nausea","Abdominal Distension"],
C2FLAG = ["Vomiting Blood or Coffee Grinds, Melena ","Severe abdominal pain"," Significant weight loss"],
C3FLAG = ["Abnormal Vitals","Abdominal rigidity/rebound (bump chair)","Severe pain","Fever with jaundice and RUQ pain","Confirmed Pregnancy","Alcoholism","Immunocompromised","RLQ Pain"],
C4FLAG = ["Toilette FULL of Blood","Vomiting Blood or Coffee Grinds","Melena","Lightheaded"],
C5FLAG = ["Diarrhea at night","Iron deficiency anemia","Vomiting"],
C6FLAG = ["Airway compromise","Coughing, choking when swallowing"],
C7FLAG = ["Vomiting Blood or Coffee Grinds","Melena","Angina", "SOB","Radiation to Back"],
D1FLAG = ["Cyanosis","Ancillary muscles","SpO2<90%","SIRS Criteria","Airway Swelling","Hives","Altered Mental Status (AMS)"],
D2FLAG = ["Irregular Pulse","H/O or FH of Heart Problems","Shoulder, jaw pain or pressure"],
E1FLAG = ["Systemic Inflammatory Response Syndrome","Flank Pain","Severe Abdominal Pain","Gross Hematuria or Passing Blood Clots"],
E2FLAG = ["Pain with testes supported","Suspect Stress Fracture (increased with weight bearing or during exercise, endurance training, change in exercise routine)","Severe Pain"],
E3FLAG = ["Female Pelvic Pain with Intercourse","Pregnant","Orthostatic, Fever"],
E4FLAG = ["Inability to void x 12 hours","Fever","Cola Colored Urine","Blood or Clots in Urine"],
F1FLAG = ["Abnormal Vital Signs","Irregular Pulse","Witnessed or H/O Seizure","Severe Headache","Heat Injury"],
F2FLAG = ["NO HEADACHE ALGORITHM EXISTS FOR THE CURRENT VERSION OF ADTMC. SEE BELOW RED FLAGS"," "," ","Sudden Onset, Severe","Focal Neurologic Signs","Blown pupil","Severe Hypertension","Fever","Vision Change/Loss"],
F3FLAG = ["Localized to a Region or 1 sided","Recent Trauma","Loss of Consciousness","Bowel/Bladder Incontinence"],
F4FLAG = ["Abnormal Vital Signs","Altered Mental Status","Focal Neurological Deficit","Recent Trauma"],
F5FLAG = ["Homicidal Intent or Attempt","Suicide Intent or Attempt","Self-injury","Altered Mental Status"],
F6FLAG = ["Deteriorating Level of Consciousness","Double Vision","Increased Restlessness, combative or agitated behavior","Repeat vomiting","Positive result from structural brain injury detection device (if available)","Seizure","Weakness or tingling in arms or legs","Devere or worsening headache","Abnormal Neuro Exam","Battle sign, Raccoon eyes","Suspected skull fracture","Anticoagulant use"],
G1FLAG = ["Suicide Ideation","Homicide Ideation","Shortness of Breath","Stiff Neck","Melena"],
G2FLAG = ["Heat Injury","Stiff Neck","Light sensitivity","Pregnant","Seizure","Lightheaded"],
H1FLAG = ["Fixed, Abnormal Pupil"," Visual Acuity Change"," Observed Foreign Body"," Penetration, Rupture"," Chemical Exposure"," Fluid Level over Iris, Pupil"],
H2FLAG = ["Open Globe"," High Risk Laceration"," Decreased Visual Acuity"," Double Vision"],
H3FLAG = ["Trauma"," Recent Surgery"," Chemical Exposure"," Fluid Level over Iris, Pupil"," Neurologic Deficits"],
H4FLAG = ["Trauma"," Neurologic Deficits"],
I1FLAG = ["Skin Changes"," Mass"," Bloody Nipple Discharge"],
I2FLAG = ["Positive hCG AND"," Pelvic Pain"," H/O Ectopic Pregnancy"," Vaginal Bleeding"],
I3FLAG = ["Sexual Assault"," Trauma"," Severe Pain"," Pregnant"],
I4FLAG = ["Fever"," Pregnant"," Non-midline Pelvic Pain","Pain with Intercourse"],
I5FLAG = ["N/A"],
I6FLAG = ["N/A"],
J1FLAG = ["Airway Compromise/Swelling"],
J2FLAG = ["N/A"],
J3FLAG = ["Facial Cellulitis"],
J4FLAG = ["Scaling with Visible Inflammation"," Abnormal Sensation"," Painful Erosions"],
J5FLAG = ["N/A"],
J6FLAG = ["Diabetic Soldiers","Significant erosions/ulcerations or malodor in affected area","Soldiers w/weakened immune systems"],
J7FLAG = ["Diabetes"," Immunodeficiency"],
J8FLAG = ["N/A"],
J9FLAG = ["Location over Tailbone"," SIRS Criteria"," Worsening on Antibiotics"," Palm of Hand"," Over Joint"," Black Eschar"],
J10FLAG = ["Eye Pain"],
J11FLAG = ["SIRS Criteria"," Animal Bite, Scratch"],
J12FLAG = ["Fever"," Pus/redness/swelling"],
J13FLAG = ["Airway Swelling"," Wheezing"," Anaphylaxis"],
J14FLAG = ["Trouble Breathing"," AMS, Drowsy"," High Risk Location"," Circumferential Burn"],
J15FLAG = ["Fever/malaise"," Epidermal sloughing"],
J16FLAG = ["N/A"],
J17FLAG = ["N/A"],
J18FLAG = ["Red Streaks up Foot"," Gangrene"," Black Eschar"],
K1FLAG = ["Altered mental status"," Abnormal vital signs"],
K2FLAG = ["T<96 degrees F"," Altered Mental Status"," Abnormal Vital Signs"," Frostbite"," Trauma"],
K3FLAG = ["Gangrene/Necrosis"," Hemorrhagic Blisters"," Hypothermia"," Frostbite"," Trauma"],
K4FLAG = ["N/A"],
K5FLAG = ["N/A"],
K6FLAG = ["N/A"],
K7FLAG = ["Swelling of Lips or Tongue","Trouble Breathing","Abnormal Vital Signs"],
L1FLAG = ["Known Infection"," High Risk Contact"],
L2FLAG = ["Exposed Pulp"," Avulsed Tooth"," Severe Pain"," Trauma"," Chest Pain, SOB"],
L3FLAG = ["Diffuse"," Bloody Diarrhea"],
L4FLAG = ["N/A"],
L5FLAG = ["N/A"],
L6FLAG = ["N/A"],
L7FLAG = ["N/A"],
L8FLAG = ["N/A"],
L9FLAG = ["N/A"],
L10FLAG = ["N/A"],
L11FLAG = ["N/A"],
L12FLAG = ["N/A"],
M1FLAG = ["N/A"],
M2FLAG = ["N/A"],
End = [];

//Map the variables to html tags
const A1decision = {  
  "DACT1" : ["Perform Rapid Strep + Culture Test (barracks, positive close contact, immunosuppressed contact, h/o ARF)"],
  "DACT2" : [],
  "DACT3" : [],
  "DPRED" : ["Red Flags. If the Soldier presents with any of the red flags, immediately disposition the Soldier as “Provider Now.” One-sided severe sore throat with fever, trouble swallowing as shown by drooling, uvula displacement, hoarseness (hot potato voice), trismus (lock jaw), and enlarged, tender tonsils are signs of a deep neck space infection like a peritonsillar abscess. Shortness of breath and stridor are signs of upper airway obstruction due to severe pharyngeal inflammation.",],
  "DP1" : ["DP1. Symptoms greater than 10 days, immunosuppression, inhaled steroid medications are related to diseases that are unlikely to go away without treatment. Hoarseness longer than 2 weeks requires a full laryngeal exam."],
  "DP2" : A1DP2,
  "DP3" : A1DP3,
  "DP4" : A1DP4,
  "DPRE" : A1DPRE,
  "DPRO" : A1PRO,
  "DLIM" : A1LIMITATIONS,
  "GEN" : A1GEN,
  "MED" : A1MEDCOM,
  "STP" : A1STP1,
  "RF" : ["SOB", "Stridor", "Deviated Uvula", "Drooling/ Trouble Swallowing ", "Stiff Neck"],
  "DDX" : A1DDX
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
"RF" : A2FLAG,
"DDX" : A2DDX
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
"RF" : A3FLAG,
"DDX" : A3DDX
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
  "RF" : A4FLAG,
  "DDX" : A4DDX
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
"STP" : A5STP1,
"RF" : A5FLAG,
"DDX" : A5DDX
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
"STP" : B1STP1,
"RF" : B1FLAG,
"DDX" : B1DDX
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
"STP" : B2STP1,
"RF" : B2FLAG,
"DDX" : B2DDX
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
"STP" : B3STP1,
"RF" : B3FLAG,
"DDX" : B3DDX
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
  "RF" : B4FLAG,
  "DDX" : B4DDX
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
  "RF" : B5FLAG,
  "DDX" : B5DDX
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
  "RF" : B6FLAG,
  "DDX" : B6DDX
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
  "RF" : B7FLAG,
  "DDX" : B7DDX
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
  "RF" : B8FLAG,
  "DDX" : B8DDX
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
"RF" : B9FLAG,
"DDX" : B9DDX
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
"RF" : B10FLAG,
"DDX" : B10DDX
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
"RF" : B11FLAG,
"DDX" : B11DDX
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
  "RF" : C1FLAG,
  "DDX" : C1DDX
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
  "RF" : C2FLAG,
  "DDX" : C2DDX
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
"RF" : C3FLAG,
"DDX" : C3DDX
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
  "RF" : C4FLAG,
  "DDX" : C4DDX
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
  "RF" : C5FLAG,
  "DDX" : C5DDX
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
  "RF" : C6FLAG,
  "DDX" : C6DDX
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
"RF" : C7FLAG,
"DDX" : C7DDX
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
"RF" : D1FLAG,
"DDX" : D1DDX
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
  "RF" : D2FLAG,
  "DDX" : D2DDX
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
  "RF" : E1FLAG,
  "DDX" : E1DDX
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
"RF" : E2FLAG,
"DDX" : E2DDX
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
"RF" : E3FLAG,
"DDX" : E3DDX
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
  "RF" : E4FLAG,
  "DDX" : E4DDX
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
  "RF" : F1FLAG,
  "DDX" : F1DDX
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
    "RF" : F2FLAG,
    "DDX" : F2DDX
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
  "RF" : F3FLAG,
  "DDX" : F3DDX
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
  "RF" : F4FLAG,
  "DDX" : F4DDX
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
  "RF" : F5FLAG,
  "DDX" : F5DDX
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
  "RF" : F6FLAG,
  "DDX" : F6DDX
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
  "RF" : G1FLAG,
  "DDX" : G1DDX
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
  "RF" : G2FLAG,
  "DDX" : G2DDX
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
  "RF" : H1FLAG,
  "DDX" : H1DDX
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
  "RF" : H2FLAG,
  "DDX" : H2DDX
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
  "RF" : H3FLAG,
  "DDX" : H3DDX
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
  "RF" : H4FLAG,
  "DDX" : H4DDX
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
  "RF" : I1FLAG,
  "DDX" : I1DDX
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
  "RF" : I2FLAG,
  "DDX" : I2DDX
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
  "RF" : I3FLAG,
  "DDX" : I3DDX
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
  "RF" : I4FLAG,
  "DDX" : I4DDX
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
  "RF" : I5FLAG,
  "DDX" : I5DDX
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
  "RF" : I6FLAG,
  "DDX" : I6DDX
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
  "RF" : J1FLAG,
  "DDX" : J1DDX
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
  "RF" : J2FLAG,
  "DDX" : J2DDX
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
  "RF" : J3FLAG,
  "DDX" : J3DDX
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
  "RF" : J4FLAG,
  "DDX" : J4DDX
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
  "RF" : J5FLAG,
  "DDX" : J5DDX
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
  "RF" : J6FLAG,
  "DDX" : J6DDX
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
  "RF" : J7FLAG,
  "DDX" : J7DDX
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
  "RF" : J8FLAG,
  "DDX" : J8DDX
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
  "RF" : J9FLAG,
  "DDX" : J9DDX
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
  "RF" : J10FLAG,
  "DDX" : J10DDX
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
  "RF" : J11FLAG,
  "DDX" : J11DDX
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
  "RF" : J12FLAG,
  "DDX" : J12DDX
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
  "RF" : J13FLAG,
  "DDX" : J13DDX
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
  "RF" : J14FLAG,
  "DDX" : J14DDX
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
  "RF" : J15FLAG,
  "DDX" : J15DDX
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
  "RF" : J16FLAG,
  "DDX" : J16DDX
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
  "RF" : J17FLAG,
  "DDX" : J17DDX
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
  "RF" : J18FLAG,
  "DDX" : J18DDX
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
  "RF" : K1FLAG,
  "DDX" : K1DDX
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
  "RF" : K2FLAG,
  "DDX" : K2DDX
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
  "RF" : K3FLAG,
  "DDX" : K3DDX
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
  "RF" : K4FLAG,
  "DDX" : K4DDX
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
  "RF" : K5FLAG,
  "DDX" : K5DDX
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
  "RF" : K6FLAG,
  "DDX" : K6DDX
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
  "RF" : K7FLAG,
  "DDX" : K7DDX
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
  "RF" : L1FLAG,
  "DDX" : L1DDX
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
  "RF" : L2FLAG,
  "DDX" : L2DDX
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
  "RF" : L3FLAG,
  "DDX" : L3DDX
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
  "RF" : L4FLAG,
  "DDX" : L4DDX
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
  "RF" : L5FLAG,
  "DDX" : L5DDX
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
  "RF" : L6FLAG,
  "DDX" : L6DDX
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
  "RF" : L7FLAG,
  "DDX" : L7DDX
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
  "RF" : L8FLAG,
  "DDX" : L8DDX
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
  "RF" : L9FLAG,
  "DDX" : L9DDX
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
  "RF" : L10FLAG,
  "DDX" : L10DDX
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
  "RF" : L11FLAG,
  "DDX" : L11DDX
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
  "RF" : L12FLAG,
  "DDX" : L12DDX
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
  "RF" : M1FLAG,
  "DDX" : M1DDX
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
  "RF" : M2FLAG,
  "DDX" : M2DDX
  }  

//map main categories to subcategories in html
const subcatboxes = {
  btnA : document.querySelector("#categoryA"),
  btnB : document.querySelector("#categoryB"),
  btnC : document.querySelector("#categoryC"),
  btnD : document.querySelector("#categoryD"),
  btnE : document.querySelector("#categoryE"),
  btnF : document.querySelector("#categoryF"),
  btnG : document.querySelector("#categoryG"),
  btnH : document.querySelector("#categoryH"),
  btnI : document.querySelector("#categoryI"),
  btnJ : document.querySelector("#categoryJ"),
  btnK : document.querySelector("#categoryK"),
  btnL : document.querySelector("#categoryL"),
  btnM : document.querySelector("#categoryM"),
  btnA1 : document.querySelector("#A-1"),
  btnA2 : document.querySelector("#A-2"),
  btnA3 : document.querySelector("#A-3"),
  btnA4 : document.querySelector("#A-4"),
  btnA5 : document.querySelector("#A-5"),
  btnB1 : document.querySelector("#B-1"),
  btnB2 : document.querySelector("#B-2"),
  btnB3 : document.querySelector("#B-3"),
  btnB4 : document.querySelector("#B-4"),
  btnB5 : document.querySelector("#B-5"),
  btnB6 : document.querySelector("#B-6"),
  btnB7 : document.querySelector("#B-7"),
  btnB8 : document.querySelector("#B-8"),
  btnB9 : document.querySelector("#B-9"),
  btnB10 : document.querySelector("#B-10"),
  btnB11 : document.querySelector("#B-11"),
  btnC1 : document.querySelector("#C-1"),
  btnC2 : document.querySelector("#C-2"),
  btnC3 : document.querySelector("#C-3"),
  btnC4 : document.querySelector("#C-4"),
  btnC5 : document.querySelector("#C-5"),
  btnC6 : document.querySelector("#C-6"),
  btnC7 : document.querySelector("#C-7"),
  btnD1 : document.querySelector("#D-1"),
  btnD2 : document.querySelector("#D-2"),
  btnE1 : document.querySelector("#E-1"),
  btnE2 : document.querySelector("#E-2"),
  btnE3 : document.querySelector("#E-3"),
  btnE4 : document.querySelector("#E-4"),
  btnF1 : document.querySelector("#F-1"),
  btnF2 : document.querySelector("#F-2"),
  btnF3 : document.querySelector("#F-3"),
  btnF4 : document.querySelector("#F-4"),
  btnF5 : document.querySelector("#F-5"),
  btnF6 : document.querySelector("#F-6"),
  btnG1 : document.querySelector("#G-1"),
  btnG2 : document.querySelector("#G-2"),
  btnH1 : document.querySelector("#H-1"),
  btnH2 : document.querySelector("#H-2"),
  btnH3 : document.querySelector("#H-3"),
  btnH4 : document.querySelector("#H-4"),
  btnI1 : document.querySelector("#I-1"),
  btnI2 : document.querySelector("#I-2"),
  btnI3 : document.querySelector("#I-3"),
  btnI4 : document.querySelector("#I-4"),
  btnI5 : document.querySelector("#I-5"),
  btnI6 : document.querySelector("#I-6"),
  btnJ1 : document.querySelector("#J-1"),
  btnJ2 : document.querySelector("#J-2"),
  btnJ3 : document.querySelector("#J-3"),
  btnJ4 : document.querySelector("#J-4"),
  btnJ5 : document.querySelector("#J-5"),
  btnJ6 : document.querySelector("#J-6"),
  btnJ7 : document.querySelector("#J-7"),
  btnJ8 : document.querySelector("#J-8"),
  btnJ9 : document.querySelector("#J-9"),
  btnJ10 : document.querySelector("#J-10"),
  btnJ11 : document.querySelector("#J-11"),
  btnJ12 : document.querySelector("#J-12"),
  btnJ13 : document.querySelector("#J-13"),
  btnJ14 : document.querySelector("#J-14"),
  btnJ15 : document.querySelector("#J-15"),
  btnJ16 : document.querySelector("#J-16"),
  btnJ17 : document.querySelector("#J-17"),
  btnJ18 : document.querySelector("#J-18"),
  btnK1 : document.querySelector("#K-1"),
  btnK2 : document.querySelector("#K-2"),
  btnK3 : document.querySelector("#K-3"),
  btnK4 : document.querySelector("#K-4"),
  btnK5 : document.querySelector("#K-5"),
  btnK6 : document.querySelector("#K-6"),
  btnK7 : document.querySelector("#K-7"),
  btnL1 : document.querySelector("#L-1"),
  btnL2 : document.querySelector("#L-2"),
  btnL3 : document.querySelector("#L-3"),
  btnL4 : document.querySelector("#L-4"),
  btnL5 : document.querySelector("#L-5"),
  btnL6 : document.querySelector("#L-6"),
  btnL7 : document.querySelector("#L-7"),
  btnL8 : document.querySelector("#L-8"),
  btnL9 : document.querySelector("#L-9"),
  btnL10 : document.querySelector("#L-10"),
  btnL11 : document.querySelector("#L-11"),
  btnL12 : document.querySelector("#L-12"),
  btnM1 : document.querySelector("#M-1"),
  btnM2 : document.querySelector("#M-2"), 
};
//map the ADTsheet in HTML to the above variables
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
  const sub3 = document.querySelector(".bg4")
  const sheets = document.querySelectorAll(".ADTsheet");
  const info_container = document.querySelector(".info-container")
  const infoTitle = document.querySelector(".info-title")
  var subpage = document.querySelector(".sub-page-bottom")
  var subwin = document.querySelector(".sub-page")
  const bottom = document.querySelector(".bottommarker");
  const tags = document.querySelectorAll(".item_tag")
  const pagetop = document.querySelector(".sub-page-banner-box");
  const line1 = document.getElementById('mainline1');
  const line2 = document.getElementById('mainline2');
  const line3 = document.getElementById('mainline3');
  var menu_banner = document.querySelector(".menu-banner-label")
  var menu_text = menu_banner.textContent
  const medsheet = document.querySelector(".medsheet")
  const med_btns = document.querySelectorAll(".medbtn")


  function setOpacity(element, opacity) {
            element.style.transition = 'all 0.5s ease';
            element.style.opacity = opacity;
            // Also set stroke opacity for better browser support
            if (opacity === '0') {
                element.style.stroke = 'transparent';
            } else {
                element.style.stroke = 'currentColor';
            }
        }
  
  let currentIconState = "Menu"
  // Function to update menu icon
  function updateMenuIcon() {
      if (main.classList.contains('active')) {
        showMenu()
        menu_banner.innerHTML = "ADTMC 2.5"
      } else if(med_bar.classList.contains("active")){
        showClose()
        menu_banner.innerHTML = "ADTMC Medications List"
      }else {
        showArrow()
        menu_banner.innerHTML = "ADTMC 2.5"
      }
  }

  let currentMenuText = "ADTMC 2.5"
  function updateMenuText(){
    if(main.classList.contains("active")){
      menu_banner.innerText = "ADTMC 2.5"
    } else if(med_bar.classList.contains("active")){
      menu_banner.innerHTML = "ADTMC Medications List"
    } else {
      menu_banner.innerText = "ADTMC 2.5"
    }
  }

          function showMenu() {
            line1.setAttribute('d', 'M5 7 L19 7');
            line2.setAttribute('d', 'M5 12 L19 12');
            line3.setAttribute('d', 'M5 17 L19 17');
            setOpacity(line1, '1');
            setOpacity(line2, '1');
            setOpacity(line3, '1');
            currentIconState = 'Menu'
        }
        
        function showArrow() {
            line1.setAttribute('d', 'M5 12 L19 12'); // Top becomes baseline
            line2.setAttribute('d', 'M5 12 L9 8');   // Middle becomes top arrow
            line3.setAttribute('d', 'M5 12 L9 16');  // Bottom becomes bottom arrow
            setOpacity(line1, '1');
            setOpacity(line2, '1');
            setOpacity(line3, '1');
            currentIconState = 'Back Arrow';
        }
        
        function showClose() {
            if (currentIconState === 'Menu') {
                // Hamburger to X
                line1.setAttribute('d', 'M5 5 L19 19'); // Top becomes left-to-right
                line2.setAttribute('d', 'M5 12 L19 12'); // Middle stays in place but will be hidden
                line3.setAttribute('d', 'M5 19 L19 5'); // Bottom becomes right-to-left
                setOpacity(line1, '1');
                setOpacity(line2, '0'); // Middle fades out
                setOpacity(line3, '1');
            } else if (currentIconState === 'Back Arrow') {
                // Arrow to X
                line1.setAttribute('d', 'M5 19 L19 5'); // Baseline becomes right-to-left
                line2.setAttribute('d', 'M5 12 L9 8');  // Top arrow stays but will be hidden
                line3.setAttribute('d', 'M5 5 L19 19'); // Bottom arrow becomes left-to-right
                setOpacity(line1, '1');
                setOpacity(line2, '0'); // Top arrow fades out
                setOpacity(line3, '1');
            }
            currentIconState = 'close';
        }

  // Function to show the appropriate ADTsheet
  function showADTsheet(sheetId) {
      // Hide all sheets first
      sheets.forEach(sheet => {
          sheet.classList.remove('selected');
      });
      // Hide the default info content
      infoContent.classList.add("hidden")
      const subPage = document.querySelector(".sub-page")
      subPage.classList.add("open")
      // Show the selected sheet
      const selectedSheet = document.getElementById(sheetId);
      if (selectedSheet) {
          selectedSheet.classList.add('selected');
      }
  }
// Update the text based on current navigation state
function updateInfoContentText() {
    const infoSubtext = infoContent.querySelector('p');
    if (main.classList.contains('active')) {
        // Main categories view
        infoContent.querySelector('h2').textContent = 'Algorithm Directed Troop Medical Care';
        infoSubtext.textContent = 'Select a category';
    } else {
        // Category view (not main)
        if(med_bar.classList.contains("active")){
          infoSubtext.textContent = 'Select a Medication'
        } else {
          infoSubtext.textContent = 'Select a subcategory';
        }
        
    }
}


  // Add event listeners to all navigation buttons
  const subItems = document.querySelectorAll(".catbtn");
  subItems.forEach(function(btn){
      btn.addEventListener("click", () => {
          var btnid = btn.id;
          var sheet = subcatboxes[btnid];
          var Su = document.querySelector(".sub-page")
          if (btn.closest(".sel-box") === main) {
              // Moving from main to category view
              main.classList.add("place-left");
              main.classList.remove("active");
              sheet.classList.add("active")
              var looking = btn.querySelector(".texticon").textContent.trim()
              var looking2 = btn.querySelector(".btn-text").textContent.trim()
              var titles = looking +" "+ looking2
              infoLabel.textContent = titles
              // Update menu icon
              updateMenuIcon();
              updateInfoContentText();
              
              // On mobile, switch to CDE panel when clicking subcategory buttons
          } else{
              infoContent.classList.add("hidden");
              var daddy = btn.closest(".sel-box")
              daddy.classList.remove("selected")
              daddy.classList.add("place-left")
              var looking = btn.querySelector(".texticon").innerHTML
              var looking2 = btn.querySelector(".btn-text").innerHTML
              var titles = looking +"<br>"+looking2
              var subtitle = looking + " "+looking2
              var subtitlebox = document.querySelector(".sub-page-banner")
              subtitlebox.innerText = subtitle
              infoTitle.innerHTML = titles
              if (window.innerWidth < 769) {
                  container.classList.add('active');
                  var pagetop = document.querySelector(".sub-page-banner-box");
                  pagetop.classList.add("min")                  
              } else {
              info_container.classList.add("active")
              }
              Su.classList.add("open")
              var sheetid = sheet.id
              sheet.classList.add("selected")
              const existing = document.getElementsByClassName("made")
              while(existing.length > 0){
                existing[0].parentNode.removeChild(existing[0])
              }
              const a = link1[sheetid]
                    const JY = [
        JY1 = a["DACT1"],
        JY2 = a["DACT2"],
        JY3 = a["DACT3"],
        JY4 = a["DPRED"],
        JY5 = a["DP1"],
        JY6 = a["DP2"],
        JY7 = a["DP3"],
        JY8 = a["DP4"],
        JY9 = a["DPRE"],
        JY10 = a["DPRO"],
        JY11 = a["DLIM"],
        JY12 = a["GEN"],
        JY13 = a["MED"],
        JY14 = a["STP"],
        JY15 = a["RF"],
        JY16 = a["DDX"],
      ]
      const JERK = [
        JY1 = sheet.querySelector(".ACT1"),
        JY2 = sheet.querySelector(".ACT2"),
        JY3 = sheet.querySelector(".ACT3"),
        JY4 = sheet.querySelector(".DPRED"),
        JY5 = sheet.querySelector(".JDP1"),
        JY6 = sheet.querySelector(".JDP2"),
        JY7 = sheet.querySelector(".JDP3"),
        JY8 = sheet.querySelector(".JDP4"),
        JY9 = sheet.querySelector(".JRETEST"),
        JY10 = sheet.querySelector(".JDPRO"),
        JY11 = sheet.querySelector(".LIM"),
        JY12 = document.querySelector(".GEN"),
        JY13 = document.querySelector(".MED"),
        JY14 = document.querySelector(".STP"),
        JY15 = document.querySelector(".RF"),
        JY16 = document.querySelector(".DDX")
      ]
      JY.forEach(ele => {
        if(ele == null){null}else{
          let position = JY.indexOf(ele)
          if(JERK[position] == null){
            null
          }else{
          const container = JERK[position]
          var ul = document.createElement("ul");
          ul.classList.add("made")
          ul.innerHTML = ""
          for (i = 0; i <= ele.length-1; i++){
            var li = document.createElement('li')
            li.innerHTML = ""
            li.innerHTML = ele[i]
            ul.appendChild(li)
          } container.appendChild(ul)
        }
        } 
      });
          }
      });
  });

  const main_menu = document.querySelector(".main_menu")
  const med_button = document.querySelector("#section_tag")

// Menu icon click functionality (acts as back button)
menuIconBox.addEventListener('click', function() {
    medsheet.classList.remove("open")
    if(main.classList.contains("active")){
        main_menu.classList.toggle("active")
        main_menu.querySelector("#section_tag").innerText = "MEDICATIONS LIST"
    }
  const subpage = document.querySelector(".sub-page");
  subpage.classList.remove("open");
  info_container.classList.remove("active")
  if(!sub3.classList.contains("closed")){
    sub3.classList.remove("keyed");
    sub3.classList.add("closed");
  }
  var lefts = document.querySelectorAll(".sel-box.place-left");
  var iteration = 0;
  var nonMainElements = [];

  lefts.forEach(L => {
    if (L !== main) {
      iteration++;
      nonMainElements.push(L);
    }
  });
  
  var sheet = document.querySelectorAll(".ADTsheet.selected");
  const classlist = ["ACT","ACTN","ACTY"];
    if(window.innerWidth < 769) {
    container.classList.remove("active");
  } if(window.innerWidth > 769){
        infoContent.classList.remove("hidden");
        var pagetop = document.querySelector(".sub-page-banner-box");
        pagetop.classList.remove("min")
  }
  sheet.forEach(el => {
    var currentel = el;
    var daughter = currentel.firstElementChild;
    var sister = daughter.nextElementSibling;
    el.classList.remove("selected");
    
    el.querySelectorAll(".Q").forEach(ele =>{
      ele.classList.remove("open");
      if(ele == el.firstElementChild){
        ele.classList.add("open");
      }
      if(classlist.some(classlist => daughter.classList.contains(classlist))){
        sister.classList.add("open");
      }
    });
    
    el.querySelectorAll(".slider").forEach(el1 =>{
      el1.classList.remove('o','yes','no');
    });
    
    el.querySelectorAll(".dispobox.Yikes").forEach(el2 =>{
      el2.classList.remove("open");
    });
    
    el.querySelectorAll(".dispobox.Nah").forEach(el3 =>{
      el3.classList.remove("open");
    });
    
    el.querySelectorAll(".close").forEach(el4 =>{
      var b = el4.closest(".Q");
      var c = b.querySelector(".dispobox.Yikes");
      var d = c.querySelector(".justbox");
      
      if(b.querySelector(".dispobox.Nah") == null){
        // Do nothing
      } else {
        var e = b.querySelector(".dispobox.Nah");
        e.querySelector(".justbox").classList.remove("open");
      }  
      
      d.classList.remove("open");
      par = el4.parentElement;
      grandpar = par.parentElement;
      
      if(grandpar.classList.contains("back2")){
        var back = b.querySelector(".back2");
      } else {
        var back = b.querySelector(".back1");
      }
      
      back.classList.remove("opened");
      b.querySelector(".front").classList.remove("closed");
    });
  });  
  // Navigation logic based on iteration count
  if(iteration > 0){
    // If there are non-main elements with place-left class
    // Remove place-left from all except the last one in the hierarchy
    if(nonMainElements.length > 0) {
      // Remove place-left from all non-main elements
      nonMainElements.forEach(ele => {
        ele.classList.remove("place-left");
        ele.classList.remove("active");
      });
      
      // Find which element should be active based on hierarchy
      // This assumes the last element in the array is the deepest in navigation
      const elementToActivate = nonMainElements[nonMainElements.length - 1];
      elementToActivate.classList.add("active");
    }
  } else {
    // If only main has place-left or no elements have it
    const sels = document.querySelectorAll(".sel-box.active");
    sels.forEach(ele => {
      ele.classList.remove("active");
    });
    
    // Reset to main view
    main.classList.remove("place-left");
    main.classList.add("active");
  }               
  updateMenuIcon();
  updateInfoContentText();
});

var justbuttons = document.querySelectorAll(".dispo-icon");
justbuttons.forEach(function(justbutton) {
  justbutton.addEventListener("click", () => {
    var c = justbutton.closest(".dispobox");
    var back;
    
    if (c.classList.contains("Yikes")) {
      back = justbutton.closest(".Q").querySelector(".back1");
    } else {
      back = justbutton.closest(".Q").querySelector(".back2");
    }
    
    var front = justbutton.closest(".Q").querySelector(".front");
    var justtarget = back.querySelector(".just")
    var just = back.querySelector(".just ul"); 
    back.classList.toggle("opened");
    front.classList.toggle("closed"); 
    c.querySelector(".justbox").classList.toggle("open");
    
    var border = c.querySelector(".dispobar");
    const style = getComputedStyle(border);
    const backgroundcolor = style.backgroundColor;    
    back.style.backgroundColor = backgroundcolor;
  });
});

var closers = document.querySelectorAll(".close")
closers.forEach(function(currentcloser){
  currentcloser.addEventListener("click",()=>{
    var b = currentcloser.closest(".Q");
    var c = b.querySelector(".dispobox.Yikes");
    var d = c.querySelector(".justbox")
    if(b.querySelector(".dispobox.Nah")==null){null}else{
    var e= b.querySelector(".dispobox.Nah")
    e.querySelector(".justbox").classList.remove("open")
    }
    d.classList.remove("open")
    par = currentcloser.parentElement
    grandpar = par.parentElement
    if(grandpar.classList.contains("back2")){
      var back = b.querySelector(".back2")
    }else{
      var back = b.querySelector(".back1")
    }
    var style = getComputedStyle(back)
    var bg = style.backgroundColor
    back.removeAttribute("style");
    back.classList.toggle("opened");
    b.querySelector(".front").classList.toggle("closed");
    justify()
  })
})

//question yes-no slider action + justify() at end
var btns = document.querySelectorAll(".Aa");
btns.forEach(function(currentbtn){
  currentbtn.addEventListener("click",()=>{
    //name variables based on button
    var Qs = currentbtn.closest(".Q");
    var ADT = Qs.closest(".ADTsheet.selected")
    var frontcard = Qs.querySelector(".dispobar")
    var slider = Qs.querySelector(".slider");
    var dispobox = Qs.querySelector(".dispobox.Yikes");
    var dispo = dispobox.querySelector(".dispo-icon")
    var box = document.querySelector(".SOAPbox")
    var note_content = document.querySelector(".item-box")
    var note_break = document.querySelector(".SOAPbreak")
    var back1 = Qs.querySelector(".back1")
    var back2 = Qs.querySelector(".back2")
    var close = Qs.querySelectorAll(".close i")
    var close_content = Qs.querySelectorAll(".just li")
    const at = dispo.attributes
    //if the slider is not active make it active
    if(!slider.classList.contains("o")){slider.classList.toggle("o")}
    //if yes - close the no dispobox, open the yes dispobox, and hide the note button
    if(currentbtn.classList.contains("Y")){
      if(Qs.querySelector(".dispobox.Nah") == null){null}else{
        var nah = Qs.querySelector(".dispobox.Nah");
        nah.classList.remove("open");
        sub3.classList.remove("keyed");
        sub3.classList.add("closed")
      }
      slider.classList.add("yes")
      slider.classList.remove("no");
    //styling
      var border = Qs.querySelector(".dispobar");
        dispobox.classList.add("open")
        const style = getComputedStyle(border);
        const color = style.backgroundColor
        const text = style.color
        slider.style.backgroundColor = color;
        slider.style.color = text
        dispo.style.backgroundColor = color;
        dispo.style.color = text
        bottombar.style.backgroundColor = color
        bottombar.style.color = text
        note_break.style.backgroundColor = text
        tags.forEach(tag =>{
          tag.style.accentColor = color
          tag.style.color = text
        })
        close_content.forEach(tag =>{
          tag.style.color = text
        })
        close.forEach(tag =>{
          tag.style.color = text
        })        
        if(back1){
          back1.style.color = text
        }
        if(back2){
          back2.style.color = text
        }
        sub3.style.backgroundColor = color
        sub3.style.color = text
        box.style.color = text
        note_content.style.color = text        
        sub3.classList.remove("closed")
        if (Qs.classList.contains("ACTN") || 
    Qs.classList.contains("ACTY") || 
    Qs.classList.contains("ACT") || 
    (Qs.nextElementSibling && Qs.nextElementSibling.classList.contains("ACTY")) || 
    (Qs.nextElementSibling && Qs.nextElementSibling.classList.contains("ACTN")) || 
    (Qs.nextElementSibling && Qs.nextElementSibling.classList.contains("ACT"))) {sub3.classList.remove("keyed")
        sub3.classList.add("closed")
        }else{
      }
        justify()
        CheckTopMarker()
      }
    if(currentbtn.classList.contains("N")){
      slider.classList.add("no")
      slider.classList.remove("yes");
      dispobox.classList.remove("open");
      if(Qs.querySelector(".dispobox.Nah") == null){
        slider.removeAttribute('style')
        sub3.classList.remove("keyed");
        sub3.classList.add("closed")
      }
        else{
          var nah = Qs.querySelector(".dispobox.Nah");
          var nahbar = nah.querySelector(".dispobar")
          const style = getComputedStyle(nahbar);
          const color = style.backgroundColor
          const text = style.color
          var d = nah.querySelector(".iconbutton")
          d.style.backgroundColor = color;
          sub3.style.backgroundColor = color
        slider.style.backgroundColor = color
        slider.style.color = text
        dispo.style.backgroundColor = color;
        dispo.setAttribute('fill', text)
        dispo.style.color = text
        bottombar.style.backgroundColor = color
        bottombar.style.color = text
        note_break.style.backgroundColor = text
        tags.forEach(tag =>{
          tag.style.accentColor = color
          tag.style.color = text
        })
        close_content.forEach(tag =>{
          tag.style.color = text
        })
        close.forEach(tag =>{
          tag.style.color = text
        })        
        if(back1){
          back1.style.color = text
        }
        if(back2){
          back2.style.color = text
        }
        sub3.style.backgroundColor = color
        dispo.setAttribute('fill', text)
        sub3.style.color = text
        box.style.color = text
        note_content.style.color = text      
          nah.classList.add("open")
          sub3.classList.remove("closed")
        }
        justify()
        CheckTopMarker()
    }
  }) 
})


function justify(){
  var ADT = document.querySelector(".ADTsheet.selected")
  var bottom = document.querySelector(".bottommarker")
  const bottomboxes = document.querySelector(".info-container")
  var QRED = ADT.querySelector(".QRED")
  var Q1 = ADT.querySelector(".Q1")
  var Q2 = ADT.querySelector(".Q2")
  var Q3 = ADT.querySelector(".Q3")
  var Q4 = ADT.querySelector(".Q4")
  var Q5 = ADT.querySelector(".Q5")
  if(QRED == null){null}else{
    if(QRED.querySelector(".dispobar").classList.contains("DACT")){
      if(QRED.querySelector(".slider").classList.contains("yes")){
        clearboard();
        let el = QRED
        let NEXT = el.nextElementSibling
        while(NEXT.classList.contains("ACTY")){
          NEXT.classList.add("open")
          if(NEXT.querySelector(".slider").classList.contains("no")){Q1.classList.add("open")}
          NEXT = NEXT.nextElementSibling
        }
      }
      if(QRED.querySelector(".slider").classList.contains("no")){
        clearboard()
        Q1.classList.add("open")
      }
    }else{
      if(QRED.querySelector(".slider").classList.contains("yes")){
        clearboard()
      }
      if(QRED.querySelector(".slider").classList.contains("no")){
        clearboard()
        if(QRED.nextElementSibling.classList.contains("ACTN")){
          QRED.nextElementSibling.classList.add("open")
          Q1.classList.add("open")

        }else{
          Q1.classList.add("open")

        }
      }
    }
  } // START OF Q1 JUSTIFY
  if(Q1 == null){null}else{
    if(Q1.querySelector(".dispobar").classList.contains("DACT")){
      if(Q1.querySelector(".slider").classList.contains("yes")){
        clearboard();
        let el = Q1
        let NEXT = el.nextElementSibling
        while(NEXT.classList.contains("ACTY")){
          NEXT.classList.add("open")
          if(NEXT.querySelector(".slider").classList.contains("no")){Q2.classList.add("open")}
          NEXT = NEXT.nextElementSibling
        }
      }
      if(Q1.querySelector(".slider").classList.contains("no")){
        clearboard()
        Q2.classList.add("open")
      }
    }else{
      if(Q1.querySelector(".slider").classList.contains("yes")){
        clearboard()
      }
      if(Q1.querySelector(".slider").classList.contains("no")){
        clearboard()
        if(Q1.nextElementSibling.classList.contains("ACTN")){
          Q1.nextElementSibling.classList.add("open")
          Q2.classList.add("open")
        }else{
          Q2.classList.add("open")
        }
      }
    }
  } // START OF Q2 JUSTIFY
  if(Q2 == null){null}else{
    if(Q2.querySelector(".dispobar").classList.contains("DACT")){
      if(Q2.querySelector(".slider").classList.contains("yes")){
        clearboard();
        let el = Q2
        let NEXT = el.nextElementSibling
        while(NEXT.classList.contains("ACTY")){
          NEXT.classList.add("open")
          if(NEXT.querySelector(".slider").classList.contains("no")){Q3.classList.add("open")}
          NEXT = NEXT.nextElementSibling
        }
      }
      if(Q2.querySelector(".slider").classList.contains("no")){
        clearboard()
        Q3.classList.add("open")
      }
    }else{
      if(Q2.querySelector(".slider").classList.contains("yes")){
        clearboard()
      }
      if(Q2.querySelector(".slider").classList.contains("no")){
        clearboard()
        if(Q2.nextElementSibling && Q2.nextElementSibling.classList.contains("ACTN")){
          Q2.nextElementSibling.classList.add("open")
          Q3.classList.add("open")
        }else{
          if(Q3){Q3.classList.add("open")}
          
        }
      }
    }
  } // START OF Q3 JUSTIFY
  if(Q3 == null){null}else{
    if(Q3.querySelector(".dispobar").classList.contains("DACT")){
      if(Q3.querySelector(".slider").classList.contains("yes")){
        clearboard();
        let el = Q3
        let NEXT = el.nextElementSibling
        while(NEXT.classList.contains("ACTY")){
          NEXT.classList.add("open")
          if(NEXT.querySelector(".slider").classList.contains("no")){if(Q4 == null){null}else{Q4.classList.add("open")}}
          NEXT = NEXT.nextElementSibling
        }
      }
      if(Q3.querySelector(".slider").classList.contains("no")){
        clearboard()
        Q4.classList.add("open")
      }
    }else{
      if(Q3.querySelector(".slider").classList.contains("yes")){
        clearboard()
      }
      if(Q3.querySelector(".slider").classList.contains("no")){
        clearboard()
        if(Q3.nextElementSibling == null){null}else{
        if(Q3.nextElementSibling.classList.contains("ACTN")){
          Q3.nextElementSibling.classList.add("open")
          if(Q4 == null){null}else{Q4.classList.add("open")}
        }else{
          if(Q4 == null){null}else{Q4.classList.add("open")}
        }}
      }
    }
  } // START OF Q4 JUSTIFY
  if(Q4 == null){null}else{
    if(Q4.querySelector(".dispobar").classList.contains("DACT")){
      if(Q4.querySelector(".slider").classList.contains("yes")){
        clearboard();
        let el = Q4
        let NEXT = el.nextElementSibling
        while(NEXT.classList.contains("ACTY")){
          NEXT.classList.add("open")
          if(NEXT.querySelector(".slider").classList.contains("no")){
            if(Q5 == null){null}else{Q5.classList.add("open")}}
          NEXT = NEXT.nextElementSibling
        }
      }
      if(Q4.querySelector(".slider").classList.contains("no")){
        clearboard()
        Q5.classList.add("open")
      }
    }else{
      if(Q4.querySelector(".slider").classList.contains("yes")){
        clearboard()
      }
      if(Q4.querySelector(".slider").classList.contains("no")){
        clearboard()
        if(Q4.nextElementSibling.classList.contains("ACTN")){
          Q4.nextElementSibling.classList.add("open")
          if(Q5 == null){null}else{Q5.classList.add("open")}
        }else{
          if(Q5 == null){null}else{Q5.classList.add("open")}
        }
      }
    }
  }
  const sectionTwo = document.querySelector(".bottommarker");
  if (sectionTwo) {
      // First, disconnect any existing observer to prevent multiple observers
      if (window.sectionTwoObserver) {
          window.sectionTwoObserver.disconnect();
      }
      
      const sectionTwoOptions = {
          threshold: 0.1 // Adjust as needed - triggers when 10% of element is out of view
      };
      
      window.sectionTwoObserver = new IntersectionObserver(function(entries, observer) {
          entries.forEach(entry => {
              if (!entry.isIntersecting) {
                  if (document.querySelector(".sub-page.open")) {
                      sectionTwo.scrollIntoView({
                          behavior: 'smooth'
                      });
                      // Stop observing after handling this event
                      observer.disconnect();
                      window.sectionTwoObserver = null;
                  }
              }
          });
      }, sectionTwoOptions);
      window.sectionTwoObserver.observe(sectionTwo);
  }
  
}

function CheckTopMarker(){
  const TopMarker = document.querySelector(".sub_page_marker");
  if (TopMarker) {
      // First, disconnect any existing observer to prevent multiple observers
      if (window.TopMarkerObserver) {
          window.TopMarkerObserver.disconnect();
      }
      const TopMarkerOptions = {
          threshold: 0.1 // Adjust as needed - triggers when 10% of element is out of view
      };
      
      window.TopMarkerObserver = new IntersectionObserver(function(entries, observer) {
          entries.forEach(entry => {
              if (!entry.isIntersecting) {
                  if(window.innerWidth<768){
                  if (document.querySelector(".sub-page.open")) {
                    var sub_page_banner = document.querySelector(".sub-page-banner").innerText
                    menu_banner.innerHTML = sub_page_banner
                    console.log("this works")
                      // Stop observing after handling this event
                      observer.disconnect();
                      window.TopMarkerObserver = null;
                  }}
              } else if(entry.isIntersecting){
                menu_banner.innerHTML = "ADTMC 2.5"
              }
          });
      }, TopMarkerOptions);
      window.TopMarkerObserver.observe(TopMarker);
  }
}

let medTimeout;
window.addEventListener('resize', function() {
    clearTimeout(medTimeout);
    medTimeout = setTimeout(function() {

        // get viewtype
        var app_state;
        if(document.querySelector(".sub-page").classList.contains("open") || medsheet.classList.contains("open")){
        // if sub-page with algorithms is open
        app_state = "ADTsheet| medsheet"
        }else{
        //we have to determine if main or if a sel-box is place-left
        if(main.classList.contains("place-left")){
         app_state = "subcategory"
        }else{

         app_state = "main"
        }
        }

        //Mobile
        if (window.innerWidth < 768) {

              infoContent.classList.add("active")
              info_container.classList.remove("active")
              if(app_state === "ADTsheet| medsheet"){
                if(!container.classList.contains("active")){
                container.classList.add("active")
                }
                if(!pagetop.classList.contains("min")){
                pagetop.classList.add("min")
                }
            }else 
              if(app_state === "subcategory" || app_state === "main"){
              container.classList.remove("active")
            }
        } else {

        //for desktop view

            pagetop.classList.remove("min")
            container.classList.remove("active");
            if(app_state === "ADTsheet| medsheet"){
              if(!info_container.classList.contains("active")){
                info_container.classList.add("active")
              }
            }else
            if(app_state ==="subcategory"){
              updateInfoContentText()
              infoContent.classList.remove("hidden")
            }else if(app_state === "main"){
              updateInfoContentText()
              infoContent.classList.remove("hidden")
            }
        }
    }, 100);
});

// Initialize variables
let MedMarkerObserver = null;

// Function to check med marker visibility
function checkmedmarker() {
  const MedMarker = document.querySelector(".med_marker");
  const medsheet = document.querySelector(".medsheet");
  const menu_banner = document.querySelector(".menu-banner-label");
  const med_banner = document.querySelector(".med_banner");
  
  
  if (!medsheet.classList.contains("open")) {
    // If medsheet is not open, disconnect observer if it exists
    if (MedMarkerObserver) {
      MedMarkerObserver.disconnect();
      MedMarkerObserver = null;
    }
    return;
  }
  
  // Disconnect any existing observer
  if (MedMarkerObserver) {
    MedMarkerObserver.disconnect();
  }
  
  // Set up the Intersection Observer
  const MedMarkerOptions = {
    threshold: 0.1 // Adjust as needed
  };
  
  MedMarkerObserver = new IntersectionObserver(function(medentries, observer) {
    medentries.forEach(medentry => {
      // Only execute if window width is less than 768px
      if (window.innerWidth < 768) {
        if (!medentry.isIntersecting) {
          menu_banner.innerText = med_banner.innerHTML
        } else {
          menu_banner.innerHTML = "ADTMC Medications List";
        }
      }
    });
  }, MedMarkerOptions);
  
  MedMarkerObserver.observe(MedMarker);
}

// Set up a MutationObserver to watch for changes to medsheet's class
function setupMedsheetObserver() {
  const medsheet = document.querySelector(".medsheet");
  if (!medsheet) {
    return;
  }
  
  const config = { attributes: true, attributeFilter: ['class'] };
  
  const medsheetObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.attributeName === 'class') {
        if (medsheet.classList.contains("open")) {
          checkmedmarker();
        } else {
          if (MedMarkerObserver) {
            MedMarkerObserver.disconnect();
            MedMarkerObserver = null;
          }
        }
      }
    });
  });
  
  medsheetObserver.observe(medsheet, config);
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', function() {
  // Set up the medsheet observer
  setupMedsheetObserver();
  
  // Also set up resize listener to recheck when window is resized
  window.addEventListener('resize', function() {
    const medsheet = document.querySelector(".medsheet");
    if (medsheet && medsheet.classList.contains("open")) {
      console.log("Window resized while medsheet is open, rechecking MedMarker");
      checkmedmarker();
    }
  });
});



// clears the board if something turns yes
// + add clear submitbar and resubmit if applicable
function clearboard(){
  const classnames = ["ACT","ACTN","ACTY"]
  var Q = event.target.closest(".Q")
  var dad = Q.closest(".ADTsheet")
  var first = dad.firstElementChild
  let CL = Q
  let CLP = CL.nextElementSibling
  while(CLP){
  CLP.classList.remove("open")
  CLP.querySelector(".slider").classList.remove("o","yes","no")
  if(CLP.querySelector(".dispobox.Yikes") == null){null}else{CLP.querySelector(".dispobox.Yikes").classList.remove("open")}
  if(CLP.querySelector(".dispobox.Nah") == null){null}else{CLP.querySelector(".dispobox.Nah").classList.remove("open")}  
  CLP = CLP.nextElementSibling
  }
  if(classnames.some(classnames => first.classList.contains(classnames))){
    var sister = first.nextElementSibling
    sister.classList.add("open")
  }
}

var contentClosing = document.querySelectorAll(".contbox-top")
contentClosing.forEach(function(el){
        el.addEventListener("click",() =>{
                var son = el.querySelector(".contbox-close")
                var dad = el.closest(".sub-page-pre");
                var box = dad.querySelector(".contbox-content");
                if(box.classList.contains("closed")){
                        box.classList.remove("closed")
                        son.classList.remove("closed")
                }else{
                        box.classList.add("closed")
                        son.classList.add("closed")
                }
        
        })
})


// submitlabel to copy the note shows up with all the checkmarks. 
const panel = document.querySelector(".bg4");
const copyButton = document.querySelector(".copy-button");
const checkbox1 = document.getElementById("checkbox1");
const checkbox2 = document.getElementById("checkbox2");
const checkbox3 = document.getElementById("checkbox3");
const helper = document.querySelector(".bg-helper")
const bottombar = document.querySelector(".submitbottom")
const finalbutton = document.querySelector(".submitbottom_button")
const med_bar = document.querySelector("#med_sel")

//show copy button
function quick(){
      panel.classList.remove("closed");
      helper.classList.add("faded")
}

// Toggle panel only if it's not keyed
panel.addEventListener('click', () => {
    if (!panel.classList.contains("keyed") && !panel.classList.contains("copied")) {
        panel.classList.add("keyed");
        helper.classList.add("faded")
    }
});

copyButton.addEventListener('click', () => {
    if(panel.classList.contains("keyed")){
      bottombar.classList.add("open")
      panel.classList.add("copied");
      panel.classList.remove("keyed");
      writenote()
    } 
});
// Close panel when clicking outside
document.addEventListener('click', (e) => {
    if (!panel.classList.contains("closed") && !panel.contains(e.target)) {
        panel.classList.remove("keyed");
        panel.classList.remove("copied")
        bottombar.classList.remove("open")
        helper.classList.remove("faded")
    }
});

//final copy button
finalbutton.addEventListener("click", ()=>{
  bottombar.classList.remove("open")
  panel.classList.add("closing")
  panel.classList.remove("keyed")
  panel.classList.remove("copied")
  setTimeout(() => {
  // Reset checkboxes to default state
  checkbox1.checked = true;  // Algorithm Note checked by default
  checkbox2.checked = false; // Red Flags unchecked
  checkbox3.checked = false; // Decision Making Point unchecked
  panel.classList.remove("closing")
  panel.classList.remove("keyed")
  panel.classList.remove("copied")
  helper.classList.remove("faded")
}, 2000);
  
})


// Track resize events with proper event handling
let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {

        // get viewtype
        var app_state;
        if(document.querySelector(".sub-page").classList.contains("open") || medsheet.classList.contains("open")){
        // if sub-page with algorithms is open
        app_state = "ADTsheet| medsheet"
        }else{
        //we have to determine if main or if a sel-box is place-left
        if(main.classList.contains("place-left")){
         app_state = "subcategory"
        }else{

         app_state = "main"
        }
        }

        //Mobile
        if (window.innerWidth < 768) {

              infoContent.classList.add("active")
              info_container.classList.remove("active")
              if(app_state === "ADTsheet| medsheet"){
                if(!container.classList.contains("active")){
                container.classList.add("active")
                }
                if(!pagetop.classList.contains("min")){
                pagetop.classList.add("min")
                }
            }else 
              if(app_state === "subcategory" || app_state === "main"){
              container.classList.remove("active")
            }
        } else {

        //for desktop view

            pagetop.classList.remove("min")
            container.classList.remove("active");
            if(app_state === "ADTsheet| medsheet"){
              if(!info_container.classList.contains("active")){
                info_container.classList.add("active")
              }
            }else
            if(app_state ==="subcategory"){
              updateInfoContentText()
              infoContent.classList.remove("hidden")
            }else if(app_state === "main"){
              updateInfoContentText()
              infoContent.classList.remove("hidden")
            }
        }
    }, 100);
});


const date = document.querySelector(".SOAPdate")
const rf_list = document.querySelector(".rf_list")
const rf_ul = document.querySelector(".rf_ul")
const submission = document.querySelector(".dispo_ul")
const group = document.querySelector(".SOAPgroup")
const doc_ul = document.querySelector(".doc_ul")


function writenote(){
var ADT = document.querySelector(".ADTsheet.selected")
var sheetid = ADT.id
const a = link1[sheetid]
      const JY = [
      JY15 = a["RF"]
      ]
const newday = new Date()
date.innerText = newday
const date_for_text = date.innerText
var subtitle = document.querySelector(".SOAPtitle")
var title = document.querySelector(".sub-page-banner")
var title_text = title.innerText
subtitle.innerText = title_text

const Geeks = []
Geeks.push("SCREENED IAW ADTMC MEDCOM PAM 40-7-21",date_for_text,"",title_text)

const existing = document.getElementsByClassName("submitmade")
  while(existing.length > 0)
  existing[0].parentNode.removeChild(existing[0])
if(document.querySelector("#checkbox2").checked === true){
    Geeks.push("RED FLAGS:")
    rf_list.classList.remove("no")
    JY15.forEach(rf =>{

      var redflag = document.createElement("li")
      redflag.classList.add("submitmade")
      redflag.classList.add("rf_tag")
      redflag.textContent = rf
      rf_ul.append(redflag)
      Geeks.push(rf)
    })
}else{rf_list.classList.add("no")}
Geeks.push("")
if(document.querySelector("#checkbox1").checked === true){
  var nodeslist = ADT.querySelectorAll(".Q.open")
  let arr = Array.from(nodeslist)
  let a = 0
  while(a < arr.length){
    var current = arr[a]
    var Qclasses = ["QRED","Q1","Q2","Q3","Q4","Q5","Q6"]
    const Qclassesindex = {
      "QRED" : ["   "],
      "Q1" : ["1."],
      "Q2" : ["2."],
      "Q3" : ["3."],
      "Q4" : ["4."],
      "Q5" : ["5."],
      "Q6" : ["6."]     
    }
    var slider = current.querySelector(".slider")
    var Ay = current.querySelector(".Aa.Y")
    var An = current.querySelector(".Aa.N");
    var action_card = current.querySelector(".action-box")
    if(slider.classList.contains("yes")){
        var ans = Ay
        var Afinal = ans
        var Atx = ans.innerHTML
    }else{
      var ans = An
      var Afinal = An
      var Atx = ans.innerHTML
    }
    var Atext = Afinal.innerText
    var query_answer = document.createElement("div")
    query_answer.classList.add("query_answer")
    query_answer.innerHTML = Atext
    query_answer.classList.add("submitmade")

    // submission.appendChild(group)
    if(current.querySelector(".Q-UL")==null){
      const Qul = current.querySelector(".Qtext").innerText
      const NumComb = Qul.toString()
      const Qfinal = NumComb.replace(/(\r\n|\n|\r)/gm, ", ")
      fstr = Qfinal.toString()
      Geeks.push(fstr)
      Geeks.push(Atx)
    }else{
      const Qul = current.querySelector(".Q-UL").innerText
      const Qulgroup = Qul.toString()
      const NumComb = Qulgroup.concat("?")
      const Qfinal = NumComb.replace(/(\r\n|\n|\r)/gm, ", ")
      fstr = Qfinal.toString()
      Geeks.push(fstr)
      Geeks.push(Atx)
    }
    var query_text = document.createElement("div")
    query_text.innerHTML = fstr
    query_text.classList.add("submitmade")
    query_text.classList.add("query_answer")
    group.append(query_text)
    group.append(query_answer)
    const dispobox = current.querySelectorAll(".dispobox")
      dispobox.forEach(el =>{
        if(el.classList.contains("open")){
          var thestuff = el.querySelector(".dispo-label")
          var thestufflabel = thestuff.innerText
          var dispo = document.createElement("div")
          dispo.classList.add("SOAPdispo")
          dispo.classList.add("submitmade")
          dispo.innerText = thestufflabel
          if(action_card){
            dispo.innerText = thestufflabel + '\n' + action_card.innerText
          }
          submission.append(dispo)
          Geeks.push("",dispo.innerText)
        }
      })
      a++
  }
  }
  if(document.querySelector("#checkbox3").checked === true){
  const ref_container = document.querySelector(".ref_ul")
  const ref_title = document.createElement("div")
  ref_title.classList.add("submitmade")
  ref_title.classList.add("SOAPdispo")
  var nodeslist = ADT.querySelectorAll(".Q.open")
  const arr = Array.from(nodeslist)
  const last = arr[arr.length-1]
  const lastopen = last.querySelector(".dispobox.open")
  if(lastopen.classList.contains("Yikes")){
  const lastopen_div = last.querySelector(".back1")
  const lastopen_div_text = lastopen_div.innerText
  ref_title.innerText = lastopen_div_text
  ref_container.append(ref_title)
  Geeks.push("","",lastopen_div_text)
  }else{
  const lastopen_div = last.querySelector(".back2")
  const lastopen_div_text = lastopen_div.innerText
  ref_title.innerText = lastopen_div_text
  ref_container.append(ref_title)
  Geeks.push("","",lastopen_div_text)
  }
  }  

  const Geekssep = Geeks.join("\n")
  navigator.clipboard.writeText(Geekssep)
}

med_button.addEventListener('click', function(){
  if(main_menu.classList.contains("active")){
    if(main.classList.contains("active")){
      main_menu.classList.remove("active")
      main.classList.remove("active")
      main.classList.add("place-left")
      med_bar.classList.add("active")
      updateInfoContentText()
      updateMenuIcon()

    }
  }
})


// medication side of the house


const medboxes = {
med1 : [
  {Category:["Trade Name"],Content:["Tylenol"]},
  {Category:["Indications"],Content:["Pain or Fever"]},
  {Category:["Adult Dosing"],Content:["325mg PO: Take 2 tabs every 6 hr daily as needed for fever or pain <br> (Maximum 2.6g in 24hrs)","235-650mg PO: Every 4-6 hr or 1000mg 3-4 times daily <br> (Maximum 4g in 24hrs)"]},
  {Category:["Pediatric Dosing"],Content:["15mg/kg/dose: Every 4-6 hr as needed <br> (Maximum 2.6g in 24 hrs)"]},
  {Category:["Contraindications"],Content:["Hypersensitiviy to acetaminophen or any component of the formulation","Hepatic impairment or liver disease"]},
  {Category:["Lactation Safety"],Content:["Safe"]},
  {Category:["Pregnancy Safety"],Content:["Class B - Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Avoid use in patient suffering alcohol toxicity, known alcohol abuse, or renal impairment","Nausea, vomiting","G6PD deficiency"]},
  {Category:["Mechanism of Action"],Content:["Analgesic effect believed to be related to serotonergic inhibitory pathways in the CNS","Antipyresis from inhibition of the hypothalamic heat-regulating center"]},
  {Category:["Aviation Considerations"],Content:["Class 1 when used infrequently or in low dosage."]}]
,
med2 :[
  {Category:["Trade Name"],Content:["Acetasol HC"]},
  {Category:["Indications"],Content:["Otitis Externa"]},
  {Category:["Adult Dosing"],Content:["ADTMC PREFERRED: AA2%, HC1% Otic: 5 drops in affected ear(s) every 6 hours",">3 years old: 3-5 drops in affected ear every 4-6 hrs while cotton wick inserted (24 hrs)","5 drops in affected ear every 6-8 hrs daily after 24 hours"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["None. >3 years old use adult dosing"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to acetic acid, propylene glycol, hydrocortisone or any components of the formulation","Perforated tympanic membrane","HSV or varicella infection","Local reaction/ irritation develops"]},
  {Category:["Lactation Safety"],Content:["Unknown- Considered Safe"]},
  {Category:["Pregnancy Safety"],Content:["Class C– Potential for Harm"]},
  {Category:["Adverse Reactions"],Content:["Stinging of ear, burning sensation","Local irritation"]},
  {Category:["Mechanism of Action"],Content:["Acetic acid has bacteriostatic and fungistatic properties.","Hydrocortisone has anti-inflammatory, anti-pruritic, and vasoconstrictive properties.","Hydrocortisone induces phospholipase A2 inhibitory proteins and inhibits the release of arachidonic acid decreasing the mediators of inflammation."]},
  {Category:["Aviation considerations"],Content:["None"]}],
med3 :[
  {Category:["Trade Name"],Content:["Aspirin","Bayer"]},
  {Category:["Indications"],Content:["Acute Coronary Syndrome","Unstable Angina","Non-ST Segment Elevated Myocardial Infarction"]},
  {Category:["Adult Dosing"],Content:["81mg PO: Chew 4 nonenteric coated baby aspirin in a single dose (4 x 81mg)"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["N/A"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to salicylates, other NSAIDs, or any component of the formulation","Asthma, Rhinitis","History of stomach ulcer, bleeding problem, black or bloody stools","Children recovering from chickenpox or flu-like symptoms due to risk of Reye syndrome"]},
  {Category:["Lactation Safety"],Content:["Unknown"]},
  {Category:["Pregnancy Safety"],Content:["Class D - Unsafe"]},
  {Category:["Adverse Reactions"],Content:["Not for use on trauma patients in the combat environment.","Risk of bleeding: Avoid use in patients with known or suspected, Bleeding disorders, GI Bleed, GI Ulcers, patients taking Coumadin, or within 24hrs of taking Alteplase (tPA) for suspected stroke"]},
  {Category:["Mechanism of Action"],Content:["Blocks cyclooxygenase (COX 1 and 2) enzymes, resulting in reduced formation of prostaglandin precursors.","Blocks formation of prostaglandin derivative, thromboxane A2, resulting ininhibited platelet aggregation.","Antipyretic, analgesic, and anti-inflammatory properties."]},
  {Category:["Aviation considerations"],Content:["None"]}],
med4 :[
  {Category:["Trade Name"],Content:["Differin Cream, 0.1% Gel is OTC"]},
  {Category:["Indications"],Content:["Acne"]},
  {Category:["Adult Dosing"],Content:["0.1% Topical: Apply a thin film once daily at bedtime <br> (nickel size amount for entire face)","0.1-0.3% Topical: Apply a thin film once daily at bedtime"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["N/A"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to adapalene or any component of the formulation","Not approved for children under 12 years old","Avoid contact with mucous membranes (eyes, nose, mouth, vaginal, and anal mucosa)","Avoid contact with broken, eczematous, or sunburned skin"]},
  {Category:["Lactation Safety"],Content:["Unknown"]},
  {Category:["Pregnancy Safety"],Content:["Class C - Potential Harm"]},
  {Category:["Adverse Reactions"],Content:["Dry skin, redness, burning or stinging of the skin, skin peeling","Skin itching","Increased susceptibility to sunburn"]},
  {Category:["Mechanism of Action"],Content:["Modulates cellular differentiation, keratinization, and the inflammatory process"]},
  {Category:["Aviation considerations"],Content:["None"]}]
  ,
med5 :[
  {Category:["Trade Name"],Content:["Proventil","Ventolin"]},
  {Category:["Indications"],Content:["Bronchospasm"]},
  {Category:["Adult Dosing"],Content:["90 mcg/puff inhaler: 2 puffs every 6 hours as needed","5.0mg Nebulizer: Every 6 hours as needed"," 90mcg/puff inhaler: 4 puffs every 20min for up to 4hr then every 2hr as needed"," 2.5-5.0mg Nebulizer: Every 20 min for 3 doses; then 2.5-10mg every 1-4 hrs as needed OR 10-15mg/hour continuous"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["90 mcg/puff inhaler: 4 puffs every 20 min for 3 doses; then every 1-4 hr as needed","2.5-5.0mg Nebulizer: Every 4-8 hours as needed"," 90mcg/puff inhaler: 4 puffs every 20min for 3 doses then every 1-4 hr as needed"," 2.5-5.0mg Nebulizer: Every 20 min for 3 doses; then 0.15-0.3mg/kg every 1-4 hrs as needed (Maximum: 10mg) OR 0.5mg/kg/hour continuous"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to albuterol or any component of the formulation","Symptomatic tachycardia"]},
  {Category:["Lactation Safety"],Content:["Unknown"]},
  {Category:["Pregnancy Safety"],Content:["Class C - Uncertain safety"]},
  {Category:["Adverse Reactions"],Content:["Risk of abortion during 1st or 2nd trimester","Headache, Dizziness, Flushing, Diaphoresis, Tremor,Weakness, Angina, A-Fib, Arrhythmia, Chest pain, Palpitations, Dyspnea, Bronchospasm in asthmatics"]},
  {Category:["Mechanism of Action"],Content:["Beta2 Agonist (Bronchodilator)","Synthetic sympathomimetic that relaxes bronchial smoothmuscle, causing bronchodilation, with little cardiac impact."]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med6 :[
  {Category:["Trade Name"],Content:["Domeboro's Solution","Boro-packs","Pedi-Boro"]},
  {Category:["Indications"],Content:["Contact Dermatitis","Skin Irritation"]},
  {Category:["Adult Dosing"],Content:["1 packet topical: 1 packet/ 16 ounces water. Soak area or apply compress for 30 minutes. Repeat every 8 hours as needed. <br> 1 Boro-Pack = 0.16%","1 soak topical: Soak area every 8 hours as needed. Aplly compress for 15-30 min as needed for itching. 1-3 packets/16 ounces water (depending on brand)"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["1-3 pkts topical: 1 packet/ 16 ounces water. Soak area every 8 hours as needed. Compress x 15-30 minutes as needed for itching <br> 1 Boro-Pack = 0.13%"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to aluminum acetate or any component of the formulation"]},
  {Category:["Lactation Safety"],Content:["Unknown"]},
  {Category:["Pregnancy Safety"],Content:["Unknown"]},
  {Category:["Adverse Reactions"],Content:["Irritation or Rash","Avoid contact with eyes, mucous membranes"]},
  {Category:["Mechanism of Action"],Content:["Astringent properties to relieve itching"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med7 :[
  {Category:["Trade Name"],Content:["Zithromax"]},
  {Category:["Indications"],Content:["Cervicitis empiric therapy","Urethritis empiric therapy","Chlamydia trachomatis","Gonococcal infection"]},
  {Category:["Adult Dosing"],Content:["1g PO: Gie one dose and observe while it is being taken (Give with Ceftriaxone)"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["1g PO: if > 45.5kg 1g as single dose"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to azithromycin, erythromycin, other macrolide antibiotics or any component of the formulation","QT interval prolongation or history of arrhythmias","Liver Disease or Severe Renal Impairment"]},
  {Category:["Lactation Safety"],Content:["Use caution; enters milk"]},
  {Category:["Pregnancy Safety"],Content:["Class B - Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Diarrhea, nausea/ vomiting, GI upset"]},
  {Category:["Mechanism of Action"],Content:["Macrolide Antibiotic","Inhibits RNA-dependent protein synthesis in susceptible organisms"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med8 :[
  {Category:["Trade Name"],Content:["Baciguent"]},
  {Category:["Indications"],Content:["Skin infection","Cut, abrasion","Blister","Burn"]},
  {Category:["Adult Dosing"],Content:["500 units/q Topical: Apply ointment 2-3 times per day to protect skin and help it heal","500 units/g Topical: Apply 1-3 times per day"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["500 units/g Topical: Apply 1-3 times per day"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to bacitracin or any component of the formulation"]},
  {Category:["Lactation Safety"],Content:["Considered Safe"]},
  {Category:["Pregnancy Safety"],Content:["Considered Safe"]},
  {Category:["Adverse Reactions"],Content:["Limit use to 1 week. If condition remains after 1 week, Soldier should be seen by a provider."]},
  {Category:["Mechanism of Action"],Content:["Inhibits bacterial cell wall synthesis by preventing the transfer of mucopeptides into the growing bacterial cell wall","Maintains a moist environment allowing for skin growth and repair"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med9 :[
  {Category:["Trade Name"],Content:["Cepacol Lozenge"]},
  {Category:["Indications"],Content:["Sore Throat","Mouth Irritation"]},
  {Category:["Adult Dosing"],Content:["1 lozenge PO: Allow 1 lozenge to dissolve slowly in mouth every 2 hours as needed","1 Lozenge PO: Every 2 hours as needed for sore throat"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:[">5 years old: Refer to Adult Dosing"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to benzocaine, para-aminobenzoic acid (PABA), or any component of the formulation","Children <5 years old, asthma, G6PD Deficiency due to risk of methemoglobinemia"]},
  {Category:["Lactation Safety"],Content:["Unsafe"]},
  {Category:["Pregnancy Safety"],Content:["Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Methemoglobinemia: blue lips/ nails, dizziness, headache, lethargy, shortness of breath"]},
  {Category:["Mechanism of Action"],Content:["Blocks the initiation and conduction of nerve impulses","Decreases the neuronal membrane’s sodium ion permeability"]},
  {Category:["Aviation considerations"],Content:["Acceptable provided the lozenge contains no prohibited medication. Benzocaine (or similar analgesic) containing throat spray or lozenge is acceptable. Long term use (more than 3 days) must be approved by the local flight surgeon."]}
]
,
med10 : [
  {Category:["Trade Name"],Content:["Acne-Clear","Acne Treatment"]},
  {Category:["Indications"],Content:["Acne"]},
  {Category:["Adult Dosing"],Content:["10% cream, gel topical: Apply to the affected area once a day in the morning for acne","2-10% Topical: Start daily and titrate up to 2-3/day as needed"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["N/A"]},
  {Category:["Contraindications"],Content:[" Hypersensitivity to benzoyl peroxide or any other component of the formulation","Development of hives, itching, or signs of allergic reaction after use","Development of severe skin irritation after use"]},
  {Category:["Lactation Safety"],Content:["Unknown"]},
  {Category:["Pregnancy Safety"],Content:["Class C - Potential Risk"]},
  {Category:["Adverse Reactions"],Content:[" Skin irritation, dry skin, skin peeling","Bleach hair, colored fabric","Combination with Dapsone may cause skin/ hair to turn a yellow/orange/tan color"]},
  {Category:["Mechanism of Action"],Content:["Release of free radical oxygen which oxidizes bacterial proteins","Decreases number of anaerobic bacteria and irritating free fatty acids"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med11 : [
  {Category:["Trade Name"],Content:["Dulcolax"]},
  {Category:["Indications"],Content:["Constipation"]},
  {Category:["Adult Dosing"],Content:["5mg PO: Take 1-2 tabs daily <br> (Maximum: 1 week use)","5mg PO: Take 1-3 tabs daily"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["6-11 years old: 5mg daily"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to bisacodyl or any of its components","Signs of intestinal obstruction or bowel perforation: nausea, vomiting, pain, distension, abdominal rigidity"]},
  {Category:["Lactation Safety"],Content:["Unknown"]},
  {Category:["Pregnancy Safety"],Content:["Class B - Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Abdominal cramps, Abdominal pain, nausea, vomiting, headache","Do Not take within 1 hour of antacids, milk, or dairy products","Swallow the tab whole"]},
  {Category:["Mechanism of Action"],Content:["Stimulated peristalsis by irritating the smooth muscles of the intestines and increases fluid accumulation in the intestines"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med12 : [
  {Category:["Trade Name"],Content:["Maalox","Pepto-Bismol"]},
  {Category:["Indications"],Content:["Diarrhea","Indigestion"]},
  {Category:["Adult Dosing"],Content:["262mg/15mL PO: Take 30mL every hour as needed for up to 2 days <br> (Maximum: 8 doses/24 hours","524mg PO: Take 1 dose every 30 minutes as needed (Maximum: 4,200mg or 8 doses)"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["N/A"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to salicylates or taking other salicylates","History of stomach ulcer, bleeding problem, black or bloody stools","Children recovering from chickenpox or flu-like symptoms due to risk of Reye syndrome"]},
  {Category:["Lactation Safety"],Content:["Unsafe"]},
  {Category:["Pregnancy Safety"],Content:["Unsafe"]},
  {Category:["Adverse Reactions"],Content:["Anxiety, confusion, tinnitus","Shake well prior to use (liquid), chew tablets well before swallowing (chewable tablets)","Can turn stools or tongue black"]},
  {Category:["Mechanism of Action"],Content:["Salicylate has an antisecretory action.","Bismuth has an antimicrobial activity against bacterial and viral gastrointestinal pathogens."]},
  {Category:["Aviation considerations"],Content:["Antacid (Maalox): When used occasionally or infrequently. Chronic use is Class 3.","Pepto Bismol: If used for minor diarrhea conditions and free of side effects for 24 hours."]}
]
,
med13 : [
  {Category:["Trade Name"],Content:["Caladryl","Calagesic"]},
  {Category:["Indications"],Content:["Contact Dermatitis","Insect Bite"]},
  {Category:["Adult Dosing"],Content:["Dab Topical: Clean and dry area. Cover affected area and let dry. Repeat every 6 hours as needed for itching.","Dab Topical: Apply as often as needed for itching."]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["Dab Topical: Apply to the affected area every 6 hours as needed for itching"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to Calamine, zinc oxide, or any of its components","Children less than 2 unless prescribed by a provider"]},
  {Category:["Lactation Safety"],Content:["Presumed Safe - Not on Breast"]},
  {Category:["Pregnancy Safety"],Content:["Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Hives, Irritation, Allergic Reaction","Shake well before use.","Avoid contact with eyes, mucous membranes, burns, or open wounds"]},
  {Category:["Mechanism of Action"],Content:["Astringent and skin protectant properties to relieve itching."]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med14 : [
  {Category:["Trade Name"],Content:["Rocephin"]},
  {Category:["Indications"],Content:["Cervicitis empiric therapy","Urethritis empiric therapy","Chlamydia trachomatis","Gonococcal infection"]},
  {Category:["Adult Dosing"],Content:["250mg IM: Inject into a large muscle mass (gluteus) one time <br> (Dilute with sterile water or 1% lidocaine)","250-500mg IM: One time injection <br> -250mg for initial therapy <br> -500mg if failed initial therapy"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["50mg/kg IM/IV: Disseminated infection <45kg Daily for 7 days <br> (Max dose: 1,000mg)","1,000mg IM/IV: Disseminated, >45kg 1,000mg daily for 7 days"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to ceftriaxone, penicillin, or beta-lactam antibiotics","Do NOT use with neonates due to risk of hyperbilirubinemia","Do NOT use with calcium-containing solutions due to causing calcium-ceftriaxone precipitates"]},
  {Category:["Lactation Safety"],Content:["Use Caution; Enters Milk"]},
  {Category:["Pregnancy Safety"],Content:["Class B - Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Induration or warm sensation at injection site","Rash or Diarrhea","Pancreatitis, Hemolytic anemia, Elevated INR"]},
  {Category:["Mechanism of Action"],Content:["3rd Generation Cephalosporin","Inhibits bacterial cell wall synthesis","Bacteria eventually lyse due to cell wall autolytic enzyme activity without concomitant synthesis activity"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med15 : [
  {Category:["Trade Name"],Content:["Benadryl"]},
  {Category:["Indications"],Content:["Allergies","Hives","Motion Sickness","Anaphylactic Reaction"]},
  {Category:["Adult Dosing"],Content:["25mg PO: Take 1 tablet every 8 hrs or at bedtime","50mg IV: ASAP after epinephrine auto-injector 50mg IV over 10minutes <br> (Maximum: 300mg in 24hrs)"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["1.25 mg/kg PO/IM: 2-5y/o 6.25mg every 6 hrs","1.25 mg/kg PO/IM: 6-12 y/o 12.5-25mg every 6 hrs","1.25 mg/kg IV: ASAP after 0.15mg IM epinephrine <br> (Maximum: 50mg dose)"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to diphenhydramine or any component of the formulation","Acute Asthma","Use on Neonates, premature infants, Nursing mothers"]},
  {Category:["Lactation Safety"],Content:["Unsafe"]},
  {Category:["Pregnancy Safety"],Content:["Class B - Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Normally causes sedation, but may cause paradoxical excitation","May have increased sedative effects when used with other sedatives or alcohol","May cause hypotension (use with caution in patient with cardiovascular disease)","Dry mouth and may increase risk of heat injury"]},
  {Category:["Mechanism of Action"],Content:["Competes with histamine for H1-receptor sites within the gastrointestinal tract, blood vessels, and respiratory tract.","Produces anticholinergic and sedative effects"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med16 : [
  {Category:["Trade Name"],Content:["Colace"]},
  {Category:["Indications"],Content:["Constipation","Hemorrhoids","Anal Fissure"]},
  {Category:["Adult Dosing"],Content:["100mg PO: Take 1 capsule twice a day <br> (Maximum: 7 days of use)","50-360mg PO: 50-360mg daily or in divided doses"]},
  {Category:["Pediatric Dosing (Age 2-11)"],Content:["50-150mg PO: Once daily or in divided doses"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to docusate sodium or any component of the formulation","Children under the age of 2"]},
  {Category:["Lactation Safety"],Content:["Unknown"]},
  {Category:["Pregnancy Safety"],Content:["Not Preferred"]},
  {Category:["Adverse Reactions"],Content:["Ensure adequate fluid intake"]},
  {Category:["Mechanism of Action"],Content:["Reduces surface tension of stool resulting in increased absorption of water and fat into stool"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med17 : [
  {Category:["Trade Name"],Content:["Aoxa","Vibramycine"]},
  {Category:["Indications"],Content:["Acne","Malaria chemoprophylaxis","Cellulitis"]},
  {Category:["Adult Dosing"],Content:["100mg PO (Acne): 100mg daily (used with topical agents)","100mg PO (Malaria chemoprophylaxis): 100mg daily, start 2 days before leaving","100mg PO (Bite): 100mg Every 12 hrs x 3-5 days","100mg PO (Cellulitis): 100mg Every 12 hrs x 7-14 days","100mg PO (Lyme): 100mg Every 12 hrs x 10-28 days"]},
  {Category:["Pediatric Dosing (> 8 yrs old)"],Content:["< 45kg, 2-4mg/kg/day PO: 2-4mg/kg/day in 1-2 divided doses <br> (maximum: 200mg/day)",">45kg, 100mg PO: Refer to adult dosing"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to doxycycline, other tetracyclines, or any component of the formulation"]},
  {Category:["Lactation Safety"],Content:["Use Caution; Enters Milk"]},
  {Category:["Pregnancy Safety"],Content:["CLASS D– Unsafe"]},
  {Category:["Adverse Reactions"],Content:["Take medication with food or 8oz water and sit-up for 30minutes after taking (prevent esophagitis)","Photosensitivity with increased risk of sunburn","Diarrhea, Severe skin reactions, Liver toxicity, Intracranial hypertension (blurry vision, headache, double vision)"]},
  {Category:["Mechanism of Action"],Content:["Tetracycline Antibiotic","Inhibits protein synthesis of ribosomal subunits of susceptible bacteria"]},
  {Category:["Aviation considerations"],Content:["None"]}]
 , med18 : [
  {Category:["Trade Name"],Content:["EpiPen"]},
  {Category:["Indications"],Content:["Anaphylactic Reaction"]},
  {Category:["Adult Dosing"],Content:["1 EpiPen IM: Inject 1 epi pen into thigh and may repeat in 10 min if not improved; follow with diphenhydramine 50 mg IV and transport to emergency care","0.3-0.5mg IM/IV: Every 5-15 min until improvement; follow with diphenhydramine 50 mg IV"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["0.01mg/kg IM: 0.01 mg/ kg of 1 mg/ mL dose follow with diphenhydramine 1.25 mg/ kg IV and transport to emergency care <br> (Maximum single dose: 0.3 mg)"]},
  {Category:["Contraindications"],Content:["Uncontrolled hypertension is a relative contraindication in more mild reactions"]},
  {Category:["Lactation Safety"],Content:["Unsafe"]},
  {Category:["Pregnancy Safety"],Content:["CLASS C- Unknown Safety"]},
  {Category:["Adverse Reactions"],Content:["Chest Pain, Tachycardia, Arrhythmias, Palpitations, Sudden death","Anxiety, Cerebral Hemorrhage, Headache"]},
  {Category:["Mechanism of Action"],Content:["Sympathomimetic, stimulates both alpha and beta adrenergic receptors, causing relaxation of the bronchial tree, cardiac stimulation (increasing myocardial oxygen consumption), and dilation of skeletal muscle blood vessels"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med19 : [
  {Category:["Trade Name"],Content:["Diflucan"]},
  {Category:["Indications"],Content:["Vaginal Yeast Infection"]},
  {Category:["Adult Dosing"],Content:["150mg PO: Take 1 tab by mouth one time","150mg PO (Severe): 150 mg every 72 hrs for 2-3 doses","150mg PO (Recurrent): 150 mg daily x 10-14 days, then 150 mg weekly x 6 months"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["N/A"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to fluconazole or any component of the formulation","QTc Prolongation, Heart Arrhythmia"]},
  {Category:["Lactation Safety"],Content:["Safe; Enters Milk"]},
  {Category:["Pregnancy Safety"],Content:["Unsafe"]},
  {Category:["Adverse Reactions"],Content:["Dizziness or Seizures","Hepatotoxicity"]},
  {Category:["Mechanism of Action"],Content:["Antifungal","Interferes with fungal cytochrome P450 activity inhibiting cell membrane formation"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med20 : [
  {Category:["Trade Name"],Content:["GlucaGen/ Glucagon Emergency Kit"]},
  {Category:["Indications"],Content:["Esophageal Food Impaction","Hypoglycemia"]},
  {Category:["Adult Dosing"],Content:["1mg IV: Inject 1 mg IV with 10 cc Normal Saline flush <br> For Hypoglycemia, follow with Dextrose IV and may repeat once in 20 minutes","1mg IM/IV: Every 20 minutes as needed <br> Hypoglycemia, give IV dextrose ASAP"]},
  {Category:["Pediatric Dosing (< 12 years)"],Content:["(<20kg) 0.5mg IV/IM: Every 20 min as needed <br> Adult dosing if over 20 kg"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to glucagon or any component of theformulation","Insulinoma","Pheochromocytoma"]},
  {Category:["Lactation Safety"],Content:["Safe"]},
  {Category:["Pregnancy Safety"],Content:["Class B - Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Should NOT be used as 1st line treatment for Hypoglycemia, AMS, or Food Bolus Impaction","Hypoglycemia patients should receive dextrose. If IV access cannot be established or if dextrose is not available, glucagon may be used as alternate until dextrose can be given.","Thiamine should precede use in patient with suspected alcoholism ormalnutrition"]},
  {Category:["Mechanism of Action"],Content:["Raises blood glucose levels by stimulating increased production of cyclic AMP","Promotes hepatic gluconeogenesis"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med21 : [
  {Category:["Trade Name"],Content:["Mucinex Childrens","Robitussin","Tussin"]},
  {Category:["Indications"],Content:["Cough"]},
  {Category:["Adult Dosing"],Content:["100mg / 5ml PO: 1 tablespoon (15mL) every 6 hours as needed for excess mucous (Max: 8 tablespoons/24 hours)","600mg PO: 1-2 tabs every 12 hours as needed for excess mucous (Max: 2400 mg/24 hours"]},
  {Category:["Pediatric Dosing (< 12 years)"],Content:["2-3 y/o: 50-100mg PO: 50mg every 4 hr as needed","4-5 y/o: 100mg every 4 hrs as needed (Maximum: 600mg / 24hrs)"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to guaifenesin or any component of the formulation","Do Not use extended release tablets in children under 12 years old","Chronic cough productive for phlegm"]},
  {Category:["Lactation Safety"],Content:["Unknown"]},
  {Category:["Pregnancy Safety"],Content:["Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Dizziness","drowsiness"]},
  {Category:["Mechanism of Action"],Content:["Increase the hydration of the respiratory tract, thus decreasing viscosity of respiratory mucous","Inhibits the cough reflex sensitivity in subjects with upper respiratory tract infections"]},
  {Category:["Aviation considerations"],Content:["Must just be guaifenesin. Many OTC cough syrups contain sedating antihistamines or Dextromethorphan (DM) and are prohibited for aviation duty."]}
],
med22 : [
  {Category:["Trade Name"],Content:["Westcort Cream"]},
  {Category:["Indications"],Content:["Irritant Dermatitis","Contact Dermatitis","Skin Inflammation/ Irritation"]},
  {Category:["Adult Dosing"],Content:["1% Topical: Apply a thin film twice a day as needed for itching or inflammation (Max: 2 weeks)","1% Topical: Apply a thin film 2-3 time per day as needed for itching or inflammation"]},
  {Category:["Pediatric Dosing (< 12 years)"],Content:[">2 years old: 1% Topical. Apply a thin film twice a day as needed for itching or inflammation"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to hydrocortisone or any component of its formulation.","OTC hydrocortisone is not labeled for use in children under 2 years old.","Diffuse areas larger than patient’s hands, occlusive dressing, heating source can result in increased doses.","Adrenal suppression can progress to adrenal crisis"]},
  {Category:["Lactation Safety"],Content:["Unknown - Considered Safe"]},
  {Category:["Pregnancy Safety"],Content:["Class C - Potential for Harm"]},
  {Category:["Adverse Reactions"],Content:["Skin atrophy, atrophic striae, hypopigmentation, burning sensation","Secondary skin infection"]},
  {Category:["Mechanism of Action"],Content:["Anti-inflammatory, anti-pruritic, and vasoconstrictive properties","Induces phospholipase A2 inhibitory proteins and inhibits the release of arachidonic acid decreasing the mediators of inflammation."]},
  {Category:["Aviation considerations"],Content:["N/A"]}
],
med23 : [
  {Category:["Trade Name"],Content:["Analpram- HC"]},
  {Category:["Indications"],Content:["Hemorrhoid","Anal Itching"]},
  {Category:["Adult Dosing"],Content:["1 dab Topical: Apply to clean, dry area 4 times/ day (Maximum: 1 week)"]},
  {Category:["Pediatric Dosing (< 12 years)"],Content:["N/A"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to hydrocortisone, pramoxine, or any component of the formulation","Caution when used in patients with heart disease or diabetes","Not approved for use in children <12 years old","Adrenal suppression can progress to adrenal crisis"]},
  {Category:["Lactation Safety"],Content:["Unknown - Not Recommended"]},
  {Category:["Pregnancy Safety"],Content:["Class C - Potential for Harm (Hydrocortisone)"]},
  {Category:["Adverse Reactions"],Content:["Skin atrophy, atrophic striae, hypopigmentation, burning sensation","Secondary skin infection"]},
  {Category:["Mechanism of Action"],Content:["Hydrocortisone has anti-inflammatory, anti-pruritic, and vasoconstrictive properties","Pramoxine is an anesthetic that interferes with pain signals sent from the nerves to the brain."]},
  {Category:["Aviation considerations"],Content:["N/A"]}
],
med24 : [
  {Category:["Trade Name"],Content:["Motrin","Advil"]},
  {Category:["Indications"],Content:["Pain","Osteoarthritis","Rheumatoid Arthritis","Antipyretic"]},
  {Category:["Adult Dosing"],Content:["200mg PO: Take 2 tabs every 6 hours as needed for pain (Maximum: 1600 mg/ day)","200-800mg PO: Every 6 hours as needed (Maximum: 3200 mg/day"]},
  {Category:["Pediatric Dosing (< 12 years)"],Content:["10mg/kg/dose: Every 6 - 8 hrs as needed (Maximum single dose: 400 mg)"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to ibuprofen or any component of the formulation","History of asthma, urticarial, or allergic-type reaction to aspirin or other NSAIDs","Aspirin triad (bronchial asthma, aspirin intolerance, rhinitis)","Use in the setting of coronary artery bypass graft (CABG) surgery or gastrointestinal bleeding"]},
  {Category:["Lactation Safety"],Content:["Enters Milk-Preferred"]},
  {Category:["Pregnancy Safety"],Content:["CLASS C - Avoid 1st, 3rd Trimester"]},
  {Category:["Adverse Reactions"],Content:["Dizziness, headache, and tinnitus","Skin rash, itching","Epigastric pain, heartburn, and nausea"]},
  {Category:["Mechanism of Action"],Content:["Reversibly inhibits cyclooxygenase-1 and 2 (COX-1 and 2) enzymes, which results in decreased formation of prostaglandin precursors","Has antipyretic, analgesic, and anti-inflammatory properties"]},
  {Category:["Aviation considerations"],Content:["N/A"]}
],
med25 : [
  {Category:["Trade Name"],Content:["Toradol"]},
  {Category:["Indications"],Content:["Moderate Pain"]},
  {Category:["Adult Dosing"],Content:["30mg IM: Inject one dose at presentation if needed for moderate pain","30mg IM/IV: 30-60mg IM or 30mg IV every 6 hours as needed (Maximum: 120mg /day, 5 days total"]},
  {Category:["Pediatric Dosing (< 12 years)"],Content:["N/A"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to ketorolac, aspirin, other NSAIDs or any component of the formulation","History of CABG, cardiovascular disease, gastrointestinal bleeding, cerebrovascular bleeding, or bleeding risk","History of asthma, urticarial, or allergic-type reaction to aspirin or other NSAIDs","Aspirin triad (bronchial asthma, aspirin intolerance, rhinitis)","Renal disease or volume depletion, receiving other NSAIDs or aspirin","During labor and delivery"]},
  {Category:["Lactation Safety"],Content:["Enters Milk-Not Preferred"]},
  {Category:["Pregnancy Safety"],Content:["CLASS C - Unsafe"]},
  {Category:["Adverse Reactions"],Content:["Headache","Gastrointestinal pain, heartburn, nausea","Drowsiness, dizziness, blurred vision"]},
  {Category:["Mechanism of Action"],Content:["Inhibits cyclooxygenase-1 and 2 (COX-1 and 2) enzymes","Has antipyretic, analgesic, and anti-inflammatory properties."]},
  {Category:["Aviation considerations"],Content:["N/A"]}
],
med26 : [
  {Category:["Trade Name"],Content:["Viscous Lidocaine 2%"]},
  {Category:["Indications"],Content:["Severe Sore Throat","Mouth Sores"]},
  {Category:["Adult Dosing"],Content:["15mL PO: Swish and spit every 6 hours as needed for pain (Maximum: 4 doses/24hrs"]},
  {Category:["Pediatric Dosing (< 3 years old)"],Content:["<1.2mL PO: Every 3 hours with cotton applicator (Maximum: 4 doses/ 12 hours)","4.5mg/kg: PO Every 3 hours swish and spit as needed. Do not swallow. (Maximum: 300mg/ dose, 4 doses/ 12 hours)"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to lidocaine to any component of the formulation.","Do not use for teething in children. Seizures and death reported in children when not administered by strict adherence to dosing recommendations."]},
  {Category:["Lactation Safety"],Content:["Enters Milk- Safe"]},
  {Category:["Pregnancy Safety"],Content:["Class B- Limited Risk"]},
  {Category:["Adverse Reactions"],Content:["Severely traumatized mucosa increases the risk of rapid systemic absorption","May impair swallowing and increase aspiration risk. Avoid food for 60min after use","Tongue/ buccal biting after use"]},
  {Category:["Mechanism of Action"],Content:["Blocks the conduction of nerve impulses by decreasing the neuronal membrane’s permeability to sodium ions, resulting in inhibition of depolarization and blockage of conduction."]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med27 : [
  {Category:["Trade Name"],Content:["Imodium"]},
  {Category:["Indications"],Content:["Diarrhea"]},
  {Category:["Adult Dosing"],Content:["2mg PO: Take 2 tabs and then 1 tab after each loose stool as needed (Maximum: 8 mg/ 4 tabs)"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["2-5 yrs (13-20 kg): 1 mg three times per day","6-8 yrs (20-30 kg): 2 mg twice a day","8-12 yrs (>30 kg): 2 mg three times per day"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to loperamide or any component of the formulation","Doses higher than recommended can cause heart arrhythmia (Torsades de Pointes) and death","Children under 2 years of age","Dysentery, abdominal pain, ulcerative colitis, bacterial enterocolitis, antibiotic associated diarrhea"]},
  {Category:["Lactation Safety"],Content:["Not Recommended"]},
  {Category:["Pregnancy Safety"],Content:["CLASS C – Potential Harm"]},
  {Category:["Adverse Reactions"],Content:["Constipation, abdominal cramps, nausea","Dizziness, drowsiness"]},
  {Category:["Mechanism of Action"],Content:["Anti-diarrheal","Inhibits peristalsis of intestinal muscles resulting in prolonged stool transit time and increased stool viscosity"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med28 : [
  {Category:["Trade Name"],Content:["Claritin"]},
  {Category:["Indications"],Content:["Seasonal Allergies","Hives"]},
  {Category:["Adult Dosing"],Content:["10mg PO: Take 1 tab daily for allergies"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["2-5 y/o: 5 mg PO once daily for allergies","6+ y/o: use adult dosing"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to loratadine or any component of the formulation"]},
  {Category:["Lactation Safety"],Content:["Use Caution- Monitor"]},
  {Category:["Pregnancy Safety"],Content:["Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Headache","Sedation and may have increased sedative effects when used with other sedatives or alcohol","In breast fed infant, monitor for drowsiness, irritability, agitation","May increase risk of heat injury"]},
  {Category:["Mechanism of Action"],Content:["Competes with histamine for H1-receptor sites within the gastrointestinal tract, blood vessels, and respiratory tract.","Second Generation, Less sedating than First Generation (diphenhydramine)"]},
  {Category:["Aviation considerations"],Content:["Short term use by individual aircrew is authorized but the aircrew member must report use of this medication to the FS/APA as soon as possible. FS/APA should be concerned not only with the use of this medication but also the underlying problem that the individual is self-treating (for example, allergic rhinitis) and the aeromedical implications of the diagnosis."]}
],
med29 : [
  {Category:["Trade Name"],Content:["BenGay, Icy Hot"]},
  {Category:["Indications"],Content:["Pain, Muscle Soreness"]},
  {Category:["Adult Dosing"],Content:["Balm Topical: Apply every 6-8 hours as needed for muscle soreness","1.5% menthol patch: Every 6-8 hrs as needed for pain (Do not leave in place for over 8 hrs)","3% Menthol Patch: Every 8-12 hours as needed for pain (Maximum: 2 uses/ day x 3 days)"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["None"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to aspirin, NSAIDS, menthol or any component of the formulation","Signs or symptoms of pain, swelling, blistering after application"]},
  {Category:["Lactation Safety"],Content:["Unknown"]},
  {Category:["Pregnancy Safety"],Content:["Do Not use in last 3 months of pregnancy"]},
  {Category:["Adverse Reactions"],Content:["Do not apply to wounds, rashes, damaged skin, mucous membranes, or right after bathing","Do not use a heating pad after application","Can cause chemical burns at application site"]},
  {Category:["Mechanism of Action"],Content:["Analgesic and anti-inflammatory properties"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med30 : [
  {Category:["Trade Name"],Content:["Flagyl"]},
  {Category:["Indications"],Content:["Bacterial Vaginosis"]},
  {Category:["Adult Dosing"],Content:["250mg PO: Take 2 tabs twice a day for 7 days","250-1000mg PO: Different conditions: 250-1000 mg 2-4 times/ day"]},
  {Category:["Pediatric Dosing (< 12 years)"],Content:["30-50mg/kg PO: Divided over 3 doses (Maximum: 2,250 mg/ day)"]},
  {Category:["Contraindications"],Content:["Do Not use alcohol when taking or within 3 days of taking. Can cause disulfiram-like reaction (flushing, tachycardia, nausea, vomiting)","Do not take during 1st Trimester of pregnancy.","History of seizures"]},
  {Category:["Lactation Safety"],Content:["Unsafe- Stop nursing for 3 days after"]},
  {Category:["Pregnancy Safety"],Content:["CLASS B– Not in 1st Trimester"]},
  {Category:["Adverse Reactions"],Content:["GI: nausea, vomiting, diarrhea, constipation, stomach cramps, anorexia","Neuropathic: neuropathy, confusion, dizziness, metallic taste, headache"]},
  {Category:["Mechanism of Action"],Content:["Cytotoxic to anaerobic bacteria","Disrupts DNA structure resulting in DNA strand breakage and inhibition of protein synthesis with resulting cell death in susceptible organisms"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med31 : [
  {Category:["Trade Name"],Content:["Aleve, Naprosyn"]},
  {Category:["Indications"],Content:["Pain Osteoarthritis","Gout","Primary Dysmenorrhea"]},
  {Category:["Adult Dosing"],Content:["ADTMC Preferred: 250mg PO: Take 1 tab every 12 hrs as needed for pain (Maximum: 500 mg/ day)","250-500mg PO: Every 12 hours as needed (Maximum: 1000 mg/ day)"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["Every 12 hours as needed (Maximum: 10 mg/ kg/ day"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to naproxen or any component of the formulation","History of asthma, uricarial, or allergic-type reaction to aspirin or other NSAIDs","Aspirin triad (bronchial asthma, aspirin intolerance, rhinitis)","Use in the setting of coronary artery bypass graft (CABG) surgery, kidney disease, or gastrointestinal bleeding"]},
  {Category:["Lactation Safety"],Content:["Enters Milk- Not Preferred"]},
  {Category:["Pregnancy Safety"],Content:["Avoid 1st, 3rd Trimester"]},
  {Category:["Adverse Reactions"],Content:["Dizziness, drowsiness, headache, andtinnitus","Skin rash, itching","Epigastric pain, heartburn, nausea, constipation"]},
  {Category:["Mechanism of Action"],Content:["Reversibly inhibits cyclooxygenase-1 and 2 (COX-1 and 2) enzymes, which results in decreased formation of prostaglandin precursors","Has antipyretic, analgesic, and anti-inflammatory properties"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med32 : [
  {Category:["Trade Name"],Content:["Macrobid"]},
  {Category:["Indications"],Content:["Urinary Tract Infection"]},
  {Category:["Adult Dosing"],Content:["ADTMC PREFERRED: 100mg PO: Take 1 capsule twice a day for 5 days","Nitrofurantoin monohydrate: 100 mg every 12 hrs x 5 days","Nitrofurantoin macrocrystals:    50-100 mg every 6hrs x 7 days","UTI prophylaxis: 50-100 mg daily at Bedtime"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["6-7mg/kg/day PO: Nitrofurantoin macrocrystals: Divide in 4 doses (every 6 hrs) x 7 days (max: 400 mg /day)"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to Nitrofurantoin or any component of the formulation","Pregnancy close to term/ delivery and neonates due to risk of hemolytic anemia","Renal impairment (anuria, oliguria), history of cholestatic jaundice or hepatic dysfunction from previous use"]},
  {Category:["Lactation Safety"],Content:["Safe with Monitoring"]},
  {Category:["Pregnancy Safety"],Content:["CLASS B– Not at Term"]},
  {Category:["Adverse Reactions"],Content:["Liver failure, Peripheral neuropathy, Pulmonary toxicity"]},
  {Category:["Mechanism of Action"],Content:["Antibiotic","Alter bacterial ribosomal proteins inhibiting protein synthesis, aerobic energy metabolism, and cell wall synthesis"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med33 : [
  {Category:["Trade Name"],Content:["Afrin"]},
  {Category:["Indications"],Content:["Nasal Congestion","Nosebleed"]},
  {Category:["Adult Dosing"],Content:["0.05% Nasal Spray: 2 sprays in affected side twice a day for 3 days (Max: 2 doses/ 24 hours)"]},
  {Category:["Pediatric Dosing (< 6 years old)"],Content:["None. > 6 refer to adult dosing"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to oxymetazoline or any component of its formulation","Child 5 years old or younger- ingestion can cause coma, bradycardia, respiratory depression, sedation"]},
  {Category:["Lactation Safety"],Content:["Unknown"]},
  {Category:["Pregnancy Safety"],Content:["Unknown, Chronic Use Unsafe"]},
  {Category:["Adverse Reactions"],Content:["Rebound nasal congestion from use >3 days","Nasal irritation, burning"]},
  {Category:["Mechanism of Action"],Content:["Stimulates alpha-adrenergic receptors causing vasoconstriction"]},
  {Category:["Aviation considerations"],Content:["Long-acting nasal sprays are restricted to no more than 3 days. Use of oxymetazoline for longer than the above time must be validated and approved by a flight surgeon. Recurrent need for nasal sprays must be evaluated by the flight surgeon. Use requires the aircrew member to be free of side effects."]}
],
med34 : [
  {Category:["Trade Name"],Content:["Nix"]},
  {Category:["Indications"],Content:["Head Lice","Pubic Lice"]},
  {Category:["Adult Dosing"],Content:["1% Topical: Head Lice, leave on 10 min then rinse. Remove nits with comb. Repeat in 7 days.","Pubic Lice- 1%, leave on 10 min then rinse."]},
  {Category:["Pediatric Dosing (< 2 months old)"],Content:["None. > 2 months old adult dosing"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to any pyrethrin or pyrethroid, or any component of the formulation","Do Not come in contact with mucosal surfaces (eyes, inside nose, mouth, ear, or vagina)","Ragweed allergy- consult provider because can cause difficulty breathing"]},
  {Category:["Lactation Safety"],Content:["Unknown"]},
  {Category:["Pregnancy Safety"],Content:["CLASS B– Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Skin irritation","Localized numbness, tingling"]},
  {Category:["Mechanism of Action"],Content:["Antiparasitic Agent","Inhibits sodium membrane channels in parasites resulting in paralysis and death"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med35 : [
  {Category:["Trade Name"],Content:["Elimite"]},
  {Category:["Indications"],Content:["Scabies"]},
  {Category:["Adult Dosing"],Content:["Scabies- 5%, apply 30 g from head to soles, leave on 8-14 hrs then rinse. May repeat in 14 days"]},
  {Category:["Pediatric Dosing (< 2 months old)"],Content:["None. >2 months old, adult dosing"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to any pyrethrin or pyrethroid, or any component of the formulation","Do Not come in contact with mucosal surfaces (eyes, inside nose, mouth, ear, or vagina)","Ragweed allergy- consult provider because can cause difficulty breathing"]},
  {Category:["Lactation Safety"],Content:["Unknown"]},
  {Category:["Pregnancy Safety"],Content:["CLASS B– Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Skin irritation","Localized numbness, tingling"]},
  {Category:["Mechanism of Action"],Content:["Antiparasitic Agent","Inhibits sodium membrane channels in parasites resulting in paralysis and death"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med36 : [
  {Category:["Trade Name"],Content:["Pyridium"]},
  {Category:["Indications"],Content:["Dysuria"]},
  {Category:["Adult Dosing"],Content:["100mg PO: Take 2 tabs every 8 hours after meals as needed for pain with urination"," Use with an antibiotic (Maximum: 600 mg per day for 2 days)"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["None"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to phenazopyridine or any component of the formulation","Discontinue if skin or sclera develop a yellow color","Kidney Disease/ Renal Impairment","G6PD deficiency"]},
  {Category:["Lactation Safety"],Content:["UNKNOWN"]},
  {Category:["Pregnancy Safety"],Content:["CLASS B – PRESUMED SAFE"]},
  {Category:["Adverse Reactions"],Content:["Headache, Dizziness","Stomach Cramps","Discolor urine, fabric or clothing, contacts (if touching after touching tablets)"]},
  {Category:["Mechanism of Action"],Content:["An azo dye that is excreted in the urine and has analgesic effect on urinary tract mucosa","Unknown mechanism"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med37 : [
  {Category:["Trade Name"],Content:["Miralax"]},
  {Category:["Indications"],Content:["Constipation","Hemorrhoids","Anal Fissure"]},
  {Category:["Adult Dosing"],Content:["17grams PO: 17 g (1 heaping tablespoon) in 4-8 ounces of beverage daily (Maximum: 2 weeks)"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["0.2-1gram/kg: Daily dose titrated to effect (Max: 17 g/ day)"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to polyethylene glycol or any component of the formulation","Suspected bowel obstruction (symptoms of nausea, vomiting, abdominal pain or distension)","Renal impairment/ kidney disease due to risk of electrolyte imbalance"]},
  {Category:["Lactation Safety"],Content:["Unknown"]},
  {Category:["Pregnancy Safety"],Content:["Unknown"]},
  {Category:["Adverse Reactions"],Content:["Nausea, diarrhea, gas, stomach cramping, stomach bloating"]},
  {Category:["Mechanism of Action"],Content:["Osmotic agent causes water retention in the stool increasing stool frequency and decreasing stool consistency"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med38 : [
  {Category:["Trade Name"],Content:["Betadine"]},
  {Category:["Indications"],Content:["Antiseptic"]},
  {Category:["Adult Dosing"],Content:["Topical: Apply to affected area as needed to clean the skin/ as needed for antiseptic"]},
  {Category:["Pediatric Dosing (< 12 years)"],Content:["N/A"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to iodine, shellfish, or any component of the formulation","Use with caution in patients with renal impairment or thyroid disorders","Do not use with deep puncture wounds or serious burns"]},
  {Category:["Lactation Safety"],Content:["Use Caution; Enters Milk"]},
  {Category:["Pregnancy Safety"],Content:["Class B - Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Irritation, itching, rash"]},
  {Category:["Mechanism of Action"],Content:["Broad spectrum germicidal agent effective against bacteria, viruses, fungi, protozoa, and spores"]},
  {Category:["Aviation considerations"],Content:["N/A"]}
],
med39 : [
  {Category:["Trade Name"],Content:["Systane Balance"]},
  {Category:["Indications"],Content:["Dry Eyes"]},
  {Category:["Adult Dosing"],Content:["1-2 drops ophthalmic: Apply 1-2 drops in affected eye every hour as needed"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["1-2 drops opthalmic: Apply 1-2 drops in affected eye"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to any components of the formulation."]},
  {Category:["Lactation Safety"],Content:["Safe"]},
  {Category:["Pregnancy Safety"],Content:["Safe"]},
  {Category:["Adverse Reactions"],Content:["Mild stinging of eye, eyelid crusting, or blurred vision.","Remove contact lenses prior to use.","Do not touch tip of applicator to any surface to avoid contamination."]},
  {Category:["Mechanism of Action"],Content:["Demulcents have protection and lubrication properties."]},
  {Category:["Aviation considerations"],Content:["Saline or other lubricating solution only. Visine or other vasoconstrictor agents are prohibited for aviation duty."]}
],
med40 : [
  {Category:["Trade Name"],Content:["Sudafed"]},
  {Category:["Indications"],Content:["Nasal Congestion"]},
  {Category:["Adult Dosing"],Content:["30mg PO: Take 2 tab every 6 hours as needed for congestion","30mg PO:Take 60 mg every 4-6 hrs as needed for congestion.","120mg PO: Take 120 mg extended release every 12 hrs as needed for congestion"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["4-5 years old 15mg PO: 15 mg every 4-6 hrs as needed for congestion","6-11 years old: 30mg PO every 4-6 hours as needed for congestion"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to pseudoephedrine or any component of its formulation","Children <4 years old","Administering with or within 2 weeks of taking a MAO Inhibitor","Hypertension, Ischemic heart disease, Diabetes, Seizure disorder"]},
  {Category:["Lactation Safety"],Content:["Use Caution; Enters Milk"]},
  {Category:["Pregnancy Safety"],Content:["Unsafe"]},
  {Category:["Adverse Reactions"],Content:["Palpitations, hypertension, tachycardia","Insomnia, feeling jittery","Urinary retention","Increased risk of heat injury"]},
  {Category:["Mechanism of Action"],Content:["Stimulates alpha-adrenergic receptors causing vasoconstriction"]},
  {Category:["Aviation considerations"],Content:["When used for mild nasal congestion in the presence of normal ventilation of the sinuses and middle ears (normal valsalva). ","Must notify supervising provider that patient is on flight status when requesting prescription."]}
],
med41 : [
  {Category:["Trade Name"],Content:["Zantac"]},
  {Category:["Indications"],Content:["Heartburn","Gastroesophageal Reflux Disease (GERD)","Erosive Esophagitis"]},
  {Category:["Adult Dosing"],Content:["ADTMC PREFERRED: 150mg PO: Take 1 tab twice a day as needed for heartburn","150mg PO: Take 1 tab 1-4 times daily as needed for GERD or erosive esophagitis"]},
  {Category:["Pediatric Dosing (< 16 years old)"],Content:["75mg-150mg PO 30 min before eating (Max 2 times/day. Max 14 days)","5-10 mg/kg/day PO: Divided into 2 doses 12 hrs apart (Maximum: 300mg/day)"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to ranitidine or any component of the formulation"]},
  {Category:["Lactation Safety"],Content:["Unknown"]},
  {Category:["Pregnancy Safety"],Content:["CLASS B- Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Vitamin B12 deficiency when used for over 2 years"]},
  {Category:["Mechanism of Action"],Content:["Competes with histamine for H2-receptor sites within the gastrointestinal tract","Inhibits gastric acid secretion and gastric volume"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med42 : [
  {Category:["Trade Name"],Content:["Lamisil"]},
  {Category:["Indications"],Content:["Athlete’s Foot (Tinea pedis)","Jock Itch (Tinea cruris)","Body Fungal Infection (Tinea corporis)"]},
  {Category:["Adult Dosing"],Content:["1% Topical: Apply to affected area x 1 week Twice a day (Tinea pedis) ","1% Topical: Apply to affected area x 1 weekDaily (Tinea cruris, corporis)","1% Topical: Apply to affected area Twice a day x 2 weeks (sides and soles of feet)"]},
  {Category:["Pediatric Dosing (< 12 years)"],Content:["N/A"]},
  {Category:["Contraindications"],Content:["Local irritation develops","If dosage form contains benzyl alcohol, can cause a fatal toxicity in neonates."]},
  {Category:["Lactation Safety"],Content:["Do Not apply near the breast"]},
  {Category:["Pregnancy Safety"],Content:["Safe"]},
  {Category:["Adverse Reactions"],Content:["Contact dermatitis, burning sensation, irritation","Not intended for use on nails, scalp, or mucosa"]},
  {Category:["Mechanism of Action"],Content:["Synthetic allylamine derivative inhibits squalene epoxidase, a key enzyme in the sterol biosynthesis in fungi.","Results in fungal cell death."]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med43 : [
  {Category:["Trade Name"],Content:["Septra, Bactrim"]},
  {Category:["Indications"],Content:["Urinary Tract Infection","REVIEW LOCAL ANTIBIOGRAM FOR POTENTIAL RESISTANCE"]},
  {Category:["Adult Dosing"],Content:["160mg/800mg PO: Take 1 double strength (DS) tab (160mg/800mg) twice a day for 3 days",""]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["6-12mg TMP/kg/day PO/IV: Divided over 2 doses (every 12 hours) (Maximum: 160mg TMP/dose)"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to Trimethoprim sulfamethoxazole, sulfonamides antibiotics, G6PD deficiency, or any component of the formulation","Pregnancy during 1st Trimester or after 32 weeks, infant <2 months","Do Not use in patient with megaloblastic anemia from folate deficiency or H=hyperkalemia"]},
  {Category:["Lactation Safety"],Content:["Avoid if baby has G6PD Def, Jaundice"]},
  {Category:["Pregnancy Safety"],Content:["Class D- not in 1st trimester"]},
  {Category:["Adverse Reactions"],Content:["Nausea/ Vomiting","Rash/ Itching","Take with 8 oz of water"]},
  {Category:["Mechanism of Action"],Content:["ContentAntibiotic against aerobic gram positive and gram negative","Inhibits bacterial folic acid synthesis and growth"]},
  {Category:["Aviation considerations"],Content:["None"]}
],
med44 : [
  {Category:["Trade Name"],Content:["Valtrex"]},
  {Category:["Indications"],Content:["Cold sores (Herpes labialis)","Herpes simplex virus (HSV)","Shingles (Herpes zoster)","Treatment should start within 72hours of symptoms"]},
  {Category:["Adult Dosing"],Content:["2grams PO: Take 2 grams twice 12 hours apart","Cold Sores: 2g PO twice every 12 hours","HSV (initial): 1g twice a day x 10 days","HSV (recurrent): 1g daily x 5 days"]},
  {Category:["Pediatric Dosing (< 12 years old)"],Content:["Varicella > 2 y/o: 20mg/kg PO three times per day x 5 days (Maximum: 1 g/dose)"]},
  {Category:["Contraindications"],Content:["Hypersensitivity to valcyclovir, acyclovir, or any component of the formulation"]},
  {Category:["Lactation Safety"],Content:["Use Caution; Enters Milk"]},
  {Category:["Pregnancy Safety"],Content:["CLASS B– Presumed Safe"]},
  {Category:["Adverse Reactions"],Content:["Headache, confusion, agitation","Nausea, abdominal pain"]},
  {Category:["Mechanism of Action"],Content:["Converts to Acyclovir,Inhibits DHA synthesis and viral replication"]},
  {Category:["Aviation considerations"],Content:["None"]}
]
}


//medbtn listener for all medications to open their respective sheet and populate the information.

med_btns.forEach(function(med_btn){
      med_btn.addEventListener("click", () => {
        const med_id = med_btn.id
        const medicationData = medboxes[med_id];
        const med_title = med_btn.innerText
        const banner = document.querySelector(".med_banner")
        banner.innerText = med_title
        container.classList.add('active');
        if(banner.classList.contains("open")){null}else{medsheet.classList.add("open")}
        // Iterate through each category item
        medicationData.forEach((item, index) => {
            // Get the content for this category
            const content = item.Content;
            updateCategoryContent(index, content)
        })
      })
})

function updateCategoryContent(categoryIndex, contentArray) {
    const contentContainers = document.querySelectorAll('.med_content_content');
    
    if (contentContainers[categoryIndex]) {
        // Clear previous content
        contentContainers[categoryIndex].innerHTML = '';
        
        // Add new content
        contentArray.forEach(contentItem => {
            const paragraph = document.createElement('div');
            paragraph.classList.add("med_content_opt")
            paragraph.innerHTML = contentItem;
            contentContainers[categoryIndex].appendChild(paragraph);
        });
    }
}
