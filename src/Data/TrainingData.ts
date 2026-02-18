export interface AudioAid {
    label: string
    file: string
    description?: string
}

export interface TaskTrainingData {
    taskNumber: string
    title: string
    conditions: string
    standards: string
    caution?: string
    performanceSteps: PerformanceStep[]
    audioAids?: AudioAid[]
    gradedSteps?: string[]
}

export interface PerformanceStep {
    number: string
    text: string
    isSubStep?: boolean
    note?: string
    warning?: string
    caution?: string
}

export function getTaskData(taskNumber: string): TaskTrainingData | undefined {
    return trainingTaskData.find(t => t.taskNumber === taskNumber)
}

export function isTaskTestable(taskNumber: string): boolean {
    const data = trainingTaskData.find(t => t.taskNumber === taskNumber)
    return !!data?.gradedSteps && data.gradedSteps.length > 0
}


export const trainingTaskData: readonly TaskTrainingData[] = [
    // Trauma Management: Assess Patient Vital Signs
    {
        taskNumber: "081-68W-3036",
        title: "Perform a Digital Block Anesthesia",
        caution: 'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection.',
        conditions: 'In an operational environment you are to obtain vital signs and determine if a patient’s vital signs are within normal limits. You are provided with a watch with a second hand (analog or digital), thermometer (electronic, glass, or tympanic), alcohol pads, cover probes, water soluble lubricant, stethoscope, sphygmomanometer, pulse oximetry device, sensing probe, pen, and SF 600 (Chronological Record of Medical Care) or electronic medical record (EMR). The use of an automated vital signs monitor is allowed if available.',
        standards: "Assess the patient’s vital signs, in accordance with the PHTLS Prehospital Trauma Life Support, while adhering to all warnings and cautions with 100% accuracy utilizing GO/ NO GO criteria",
        performanceSteps: [
            { number: "1", text: "Gather necessary equipment: stethoscope and sphygmomanometer." },
            { number: "2", text: "Identify the patient and explain the procedure." },
            { number: "3", text: "Position the patient with the arm supported at heart level." },
            { number: "4", text: "Apply the blood pressure cuff to the upper arm." },
            { number: "4a", text: "Center the bladder of the cuff over the brachial artery.", isSubStep: true },
            { number: "4b", text: "Wrap the cuff snugly around the arm approximately 1 inch above the antecubital fossa.", isSubStep: true },
            { number: "5", text: "Palpate the radial pulse and inflate the cuff until the pulse is no longer felt. Note the reading." },
            { number: "6", text: "Deflate the cuff completely and wait 15-30 seconds." },
            { number: "7", text: "Place the stethoscope over the brachial artery." },
            { number: "8", text: "Inflate the cuff 20-30 mmHg above the previously noted reading." },
            { number: "9", text: "Slowly deflate the cuff at a rate of 2-3 mmHg per second.", note: "Deflating too quickly may result in an inaccurate reading." },
            { number: "10", text: "Note the reading when the first Korotkoff sound is heard (systolic pressure)." },
            { number: "11", text: "Note the reading when the Korotkoff sounds disappear (diastolic pressure)." },
            { number: "12", text: "Completely deflate and remove the cuff." },
            { number: "13", text: "Record the blood pressure reading, the arm used, and the patient's position." },
        ]
    },
    {
        taskNumber: "081-000-1001",
        title: "Assess Patient Vital Signs",
        caution: 'All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection.',
        conditions: 'In an operational environment you are to obtain vital signs and determine if a patient’s vital signs are within normal limits. You are provided with a watch with a second hand (analog or digital), thermometer (electronic, glass, or tympanic), alcohol pads, cover probes, water soluble lubricant, stethoscope, sphygmomanometer, pulse oximetry device, sensing probe, pen, and SF 600 (Chronological Record of Medical Care) or electronic medical record (EMR). The use of an automated vital signs monitor is allowed if available.',
        standards: "Assess the patient’s vital signs, in accordance with the PHTLS Prehospital Trauma Life Support, while adhering to all warnings and cautions with 100% accuracy utilizing GO/ NO GO criteria",
        performanceSteps: [
            { number: "1", text: "Gather necessary equipment: stethoscope and sphygmomanometer." },
            { number: "2", text: "Identify the patient and explain the procedure." },
            { number: "3", text: "Position the patient with the arm supported at heart level." },
            { number: "4", text: "Apply the blood pressure cuff to the upper arm." },
            { number: "4a", text: "Center the bladder of the cuff over the brachial artery.", isSubStep: true },
            { number: "4b", text: "Wrap the cuff snugly around the arm approximately 1 inch above the antecubital fossa.", isSubStep: true },
            { number: "5", text: "Palpate the radial pulse and inflate the cuff until the pulse is no longer felt. Note the reading." },
            { number: "6", text: "Deflate the cuff completely and wait 15-30 seconds." },
            { number: "7", text: "Place the stethoscope over the brachial artery." },
            { number: "8", text: "Inflate the cuff 20-30 mmHg above the previously noted reading." },
            { number: "9", text: "Slowly deflate the cuff at a rate of 2-3 mmHg per second.", note: "Deflating too quickly may result in an inaccurate reading." },
            { number: "10", text: "Note the reading when the first Korotkoff sound is heard (systolic pressure)." },
            { number: "11", text: "Note the reading when the Korotkoff sounds disappear (diastolic pressure)." },
            { number: "12", text: "Completely deflate and remove the cuff." },
            { number: "13", text: "Record the blood pressure reading, the arm used, and the patient's position." },
        ],
        audioAids: [
            { label: "Normal Breath Sounds", file: "normal_breath_sounds.mp3", description: "Clear, soft sounds heard over most lung fields during normal respiration" },
            { label: "Crackles (Rales)", file: "crackles.mp3", description: "Discontinuous popping sounds, often indicating fluid in the airways" },
            { label: "Wheezing", file: "wheezing.mp3", description: "High-pitched whistling sound indicating narrowed airways" },
            { label: "Stridor", file: "stridor.mp3", description: "Harsh, high-pitched sound indicating upper airway obstruction" },
        ]
    },
    {
        taskNumber: "081-000-1001-alt",
        title: "Measure a Patient's Blood Pressure",
        conditions: "You have a patient who requires a blood pressure measurement. You will need a stethoscope and a sphygmomanometer (blood pressure cuff). The patient is in a clinical or field environment.",
        standards: "Obtain an accurate systolic and diastolic blood pressure reading using a manual sphygmomanometer and stethoscope. Record the reading correctly.",
        performanceSteps: [
            { number: "1", text: "Gather necessary equipment: stethoscope and sphygmomanometer." },
            { number: "2", text: "Identify the patient and explain the procedure." },
            { number: "3", text: "Position the patient with the arm supported at heart level." },
            { number: "4", text: "Apply the blood pressure cuff to the upper arm." },
            { number: "4a", text: "Center the bladder of the cuff over the brachial artery.", isSubStep: true },
            { number: "4b", text: "Wrap the cuff snugly around the arm approximately 1 inch above the antecubital fossa.", isSubStep: true },
            { number: "5", text: "Palpate the radial pulse and inflate the cuff until the pulse is no longer felt. Note the reading." },
            { number: "6", text: "Deflate the cuff completely and wait 15-30 seconds." },
            { number: "7", text: "Place the stethoscope over the brachial artery." },
            { number: "8", text: "Inflate the cuff 20-30 mmHg above the previously noted reading." },
            { number: "9", text: "Slowly deflate the cuff at a rate of 2-3 mmHg per second.", note: "Deflating too quickly may result in an inaccurate reading." },
            { number: "10", text: "Note the reading when the first Korotkoff sound is heard (systolic pressure)." },
            { number: "11", text: "Note the reading when the Korotkoff sounds disappear (diastolic pressure)." },
            { number: "12", text: "Completely deflate and remove the cuff." },
            { number: "13", text: "Record the blood pressure reading, the arm used, and the patient's position." },
        ]
    },
    // Medication Management: Treat a Poisoned Casualty
    {
        taskNumber: "081-000-0025",
        title: "Treat a Poisoned Casualty",
        conditions: "You are treating a casualty who has ingested, inhaled, absorbed, or been injected with a potentially toxic substance. Field or clinical setting with standard medical supplies available.",
        standards: "Identify the signs and symptoms of poisoning, initiate appropriate treatment based on the route of exposure, and prepare the casualty for evacuation if necessary.",
        performanceSteps: [
            { number: "1", text: "Assess the scene for safety.", warning: "Do not expose yourself to the same toxic substance. Ensure the area is safe before approaching the casualty." },
            { number: "2", text: "Perform a rapid patient assessment (MARCH)." },
            { number: "3", text: "Attempt to identify the poison, route of exposure, and time of exposure." },
            { number: "3a", text: "Gather information from the casualty, bystanders, or containers/labels at the scene.", isSubStep: true },
            { number: "3b", text: "Note any unusual odors, stains, or burns around the mouth or skin.", isSubStep: true },
            { number: "4", text: "For ingested poisons:", note: "Do NOT induce vomiting unless directed by medical authority or poison control." },
            { number: "4a", text: "If conscious and able to swallow, administer water or milk to dilute the substance if appropriate.", isSubStep: true },
            { number: "4b", text: "Position the casualty on their left side (recovery position) to reduce absorption.", isSubStep: true },
            { number: "5", text: "For inhaled poisons:" },
            { number: "5a", text: "Move the casualty to fresh air immediately.", isSubStep: true },
            { number: "5b", text: "Administer oxygen if available and indicated.", isSubStep: true },
            { number: "6", text: "For absorbed (skin contact) poisons:" },
            { number: "6a", text: "Remove contaminated clothing.", isSubStep: true, caution: "Wear appropriate PPE to avoid secondary contamination." },
            { number: "6b", text: "Flush the affected area with large amounts of water for at least 20 minutes.", isSubStep: true },
            { number: "7", text: "Monitor vital signs and reassess the casualty continuously." },
            { number: "8", text: "Prepare the casualty for evacuation. Bring any containers, labels, or samples of the suspected poison." },
        ]
    },
    // Trauma Management: Treat a Casualty with a Neck Wound
    {
        taskNumber: "081-68W-0091",
        title: "Treat a Casualty with a Neck Wound",
        conditions: "You are treating a casualty with a wound to the neck in a field or clinical environment. Standard medical supplies are available including occlusive dressings.",
        standards: "Control hemorrhage, maintain the airway, and prevent air embolism. Prepare the casualty for evacuation.",
        performanceSteps: [
            { number: "1", text: "Assess the casualty and identify the neck wound.", warning: "Neck wounds are potentially life-threatening due to major blood vessels and airway structures. Treat immediately." },
            { number: "2", text: "Expose the wound while maintaining cervical spine precautions if trauma is suspected." },
            { number: "3", text: "Apply an occlusive dressing to the wound.", caution: "An occlusive dressing is critical to prevent air embolism from a venous injury." },
            { number: "3a", text: "Cover the wound completely with the occlusive material.", isSubStep: true },
            { number: "3b", text: "Tape the dressing on all four sides.", isSubStep: true },
            { number: "4", text: "Apply direct pressure to control hemorrhage." },
            { number: "4a", text: "Do NOT apply circumferential pressure around the neck.", isSubStep: true, warning: "Circumferential pressure may occlude the airway or restrict blood flow to the brain." },
            { number: "5", text: "Maintain the airway. Be prepared to suction or position the casualty if the airway becomes compromised." },
            { number: "6", text: "Monitor for signs of airway obstruction, expanding hematoma, or air embolism." },
            { number: "7", text: "Administer oxygen if available." },
            { number: "8", text: "Prepare the casualty for urgent evacuation." },
        ]
    },
    // Airway Management: Administer Oxygen
    {
        taskNumber: "081-000-0073",
        title: "Administer Oxygen",
        conditions: "You have a patient requiring supplemental oxygen. Oxygen delivery equipment is available including cylinder, regulator, and delivery devices (nasal cannula, non-rebreather mask).",
        standards: "Correctly set up oxygen delivery equipment, select the appropriate delivery device, administer oxygen at the prescribed or appropriate flow rate, and monitor the patient.",
        performanceSteps: [
            { number: "1", text: "Assess the patient and determine the need for supplemental oxygen.", note: "Indications include: SpO2 < 94%, respiratory distress, shock, altered mental status, chest pain, or severe trauma." },
            { number: "2", text: "Select the appropriate oxygen delivery device based on the patient's condition." },
            { number: "2a", text: "Nasal cannula: 1-6 LPM for mild hypoxia (delivers 24-44% O2).", isSubStep: true },
            { number: "2b", text: "Non-rebreather mask: 10-15 LPM for severe hypoxia (delivers 60-100% O2).", isSubStep: true },
            { number: "3", text: "Assemble and test the oxygen delivery system." },
            { number: "3a", text: "Attach the regulator to the oxygen cylinder.", isSubStep: true, caution: "Ensure the cylinder valve is closed before attaching the regulator. Never use oil or grease on oxygen equipment." },
            { number: "3b", text: "Open the cylinder valve slowly and check the pressure gauge.", isSubStep: true },
            { number: "3c", text: "Attach the delivery device to the regulator.", isSubStep: true },
            { number: "3d", text: "Set the flow rate and verify oxygen flow.", isSubStep: true },
            { number: "4", text: "Apply the delivery device to the patient." },
            { number: "4a", text: "For nasal cannula: insert prongs into the nares and secure tubing around the ears.", isSubStep: true },
            { number: "4b", text: "For non-rebreather mask: fill the reservoir bag before placing on the patient, then secure the mask over the nose and mouth.", isSubStep: true },
            { number: "5", text: "Monitor the patient's response: respiratory rate, SpO2, skin color, and level of consciousness." },
            { number: "6", text: "Document the flow rate, delivery device, time initiated, and patient response." },
        ]
    },
    // Fluid Management: Administer Fluids Through an Infusion
    {
        taskNumber: "081-68W-0314",
        title: "Administer Fluids Through an Infusion",
        conditions: "You have a patient requiring intravenous (IV) fluid therapy. IV supplies are available including IV solution, administration set, catheters, tourniquet, antiseptic, tape, and sharps container.",
        standards: "Successfully establish a patent IV line using aseptic technique. Regulate the flow rate as prescribed or appropriate. Secure the site and monitor for complications.",
        performanceSteps: [
            { number: "1", text: "Verify the order and select the correct IV solution.", note: "Check the solution for clarity, expiration date, and correct type. Common solutions: 0.9% Normal Saline, Lactated Ringer's." },
            { number: "2", text: "Prepare the IV administration set." },
            { number: "2a", text: "Close the roller clamp on the IV tubing.", isSubStep: true },
            { number: "2b", text: "Remove the protective cover from the IV bag port and spike the bag.", isSubStep: true },
            { number: "2c", text: "Squeeze the drip chamber to fill it halfway.", isSubStep: true },
            { number: "2d", text: "Open the roller clamp and prime the tubing, removing all air bubbles.", isSubStep: true, warning: "Ensure all air is expelled from the tubing before connecting to the patient. Air embolism can be fatal." },
            { number: "2e", text: "Close the roller clamp.", isSubStep: true },
            { number: "3", text: "Select the IV catheter size appropriate for the patient and purpose." },
            { number: "4", text: "Select and prepare the insertion site." },
            { number: "4a", text: "Apply the tourniquet 3-4 inches above the selected site.", isSubStep: true },
            { number: "4b", text: "Palpate for a suitable vein (bouncy, visible, straight).", isSubStep: true },
            { number: "4c", text: "Cleanse the site with antiseptic using a circular motion from center outward. Allow to dry.", isSubStep: true },
            { number: "5", text: "Perform the venipuncture." },
            { number: "5a", text: "Anchor the vein by applying traction to the skin below the insertion site.", isSubStep: true },
            { number: "5b", text: "Insert the catheter bevel-up at a 15-30 degree angle.", isSubStep: true },
            { number: "5c", text: "Observe for blood return (flashback) in the catheter hub.", isSubStep: true },
            { number: "5d", text: "Advance the catheter into the vein and withdraw the needle.", isSubStep: true },
            { number: "5e", text: "Release the tourniquet.", isSubStep: true },
            { number: "6", text: "Connect the IV tubing to the catheter hub." },
            { number: "7", text: "Open the roller clamp and verify flow.", note: "Check for infiltration: swelling, coolness, or pain at the site." },
            { number: "8", text: "Regulate the flow rate as prescribed." },
            { number: "9", text: "Secure the catheter and tubing with tape or a transparent dressing." },
            { number: "10", text: "Label the site with date, time, catheter size, and your initials." },
            { number: "11", text: "Document the procedure: site, catheter size, solution, flow rate, and patient response." },
        ]
    },
    // Airway Management: Perform Patient Suctioning
    {
        taskNumber: "081-000-0061",
        title: "Perform Patient Suctioning",
        conditions: "In an operational environment, you have a patient that requires suctioning. You may have a portable suction apparatus, suction tubing, a rigid or flexible suction catheter, saline solution or sterile water, basin, gloves, goggles, collection bottle, oxygen delivery system, and an SF 600 (Chronological Record of Medical Care), or the patient's electronic medical record (EMR). You have performed a patient care handwash, gathered equipment, and performed a patient baseline vital signs assessment.",
        standards: "Perform suctioning in accordance with the Clinical Patient Guidelines, while adhering to all warnings and cautions, without error, using the task GO/NO GO checklist.",
        caution: "All body fluids should be considered potentially infectious. Always observe body substance isolation precautions by wearing gloves and eye protection as a minimal standard of protection.",
        gradedSteps: ["1","2","3","4","5","6","7","8","9","10","11"],
        performanceSteps: [
            { number: "1", text: "Prepare equipment.", warning: "Eye protection is required when performing suctioning procedures." },
            { number: "1a", text: "Turn on the suction in order to check proper functioning.", isSubStep: true },
            { number: "1b", text: "Open the basin package.", isSubStep: true },
            { number: "1c", text: "Pour the saline solution into the basin.", isSubStep: true },
            { number: "1d", text: "Open the suction catheter package.", isSubStep: true },
            { number: "1e", text: "Attach catheter to the suction tubing.", isSubStep: true },
            { number: "2", text: "Explain the procedure to the patient, if conscious." },
            { number: "3", text: "Don personal protective equipment." },
            { number: "4", text: "Position the patient." },
            { number: "4a", text: "Position a conscious patient in a semi-Fowler's (semi-sitting) position.", isSubStep: true },
            { number: "4b", text: "Position a severe trauma patient, onto their side allowing gravity to assist in clearing the airway.", isSubStep: true },
            { number: "5", text: "Hyper-oxygenate the patient with 100% oxygen." },
            { number: "5a", text: "Increase the oxygen to 100% for up to 2 minutes if the patient is already receiving oxygen therapy in order to hyper-oxygenate.", isSubStep: true },
            { number: "5b", text: "Instruct the patient to take a minimum of five deep breaths or administer the breaths with a bag-valve-mask system, if the patient is not receiving oxygen therapy.", isSubStep: true, note: "After each suctioning attempt or suctioning period, reoxygenate the patient.", caution: "Suctioning activities should pause if the patient has a pulse oximeter reading less than 92%." },
            { number: "5c", text: "Monitor the patient's pulse oximeter reading during the entire procedure.", isSubStep: true },
            { number: "6", text: "Test the patency of the catheter." },
            { number: "6a", text: "Turn the suction unit on with your nondominant hand.", isSubStep: true },
            { number: "6a1", text: "Adults: negative pressures of 120 to 150 millimeters of mercury (mmHg).", isSubStep: true },
            { number: "6a2", text: "Children: negative pressures of 100 to 120 mmHg.", isSubStep: true },
            { number: "6a3", text: "Infants: negative pressures of 80 to 100 mmHg.", isSubStep: true },
            { number: "6b", text: "Pick up attached suction tubing using your nondominant hand.", isSubStep: true, note: "The suction tubing is considered contaminated. After this is touched, then that hand is considered contaminated." },
            { number: "6c", text: "Insert the catheter tip into the saline solution using your dominant hand.", isSubStep: true, note: "Moistening the catheter lubricates the catheter and helps to minimize trauma to the mucous membranes and increases the patient's comfort." },
            { number: "6d", text: "Occlude the suction control port with your nondominant thumb while observing the saline entering the drainage bottle.", isSubStep: true },
            { number: "7", text: "Suction the patient." },
            { number: "7a", text: "Rigid catheter.", isSubStep: true },
            { number: "7a1", text: "Instruct a conscious patient to cough to help bring secretions up to the back of their throat.", isSubStep: true },
            { number: "7a2", text: "Use the cross-finger method of opening the airway with your nondominate hand, if the patient is unconscious.", isSubStep: true },
            { number: "7a3", text: "Place the convex (outward curving) side of the rigid tip against the roof of the mouth and insert to the base of the tongue.", isSubStep: true, note: "A rigid tip does not need to be measured. Only insert the tip as far as you can see it. Be aware that advancing the catheter too far may stimulate the patient's gag reflex and cause them to vomit.", warning: "Never suction for more than 15 seconds at one time for adults, 10 seconds for children, and 5 seconds for infants. Longer periods of continuous suctioning may cause oxygen deprivation." },
            { number: "7a4", text: "Apply suction by placing the thumb of your dominant hand over the suction control port.", isSubStep: true },
            { number: "7a5", text: "Clear the secretions from the catheter between each suctioning interval by inserting the tip into the saline solution and suction the solution through the catheter until the catheter is clear of secretions.", isSubStep: true },
            { number: "7a6", text: "Repeat steps 7a(1) through 7a(5) until all secretions have been removed or until the patient's breathing becomes easier.", isSubStep: true, note: "If no suction is required go to step 10." },
            { number: "7b", text: "Flexible catheter.", isSubStep: true },
            { number: "7b1", text: "Measure the catheter from the patient's earlobe to the corner of the mouth or the center of the mouth to the angle of the jaw.", isSubStep: true, warning: "Insert the catheter no further down than the base of the tongue." },
            { number: "7b2", text: "Insert the catheter into the patient's mouth to the correct depth no lower than the back of throat, without the suction applied.", isSubStep: true, note: "If an oropharyngeal airway is in place, insert the catheter alongside the airway and then back into the pharynx." },
            { number: "7b3", text: "Place the thumb of your nondominant hand over the suction control port on the catheter, applying intermittent suction by moving your thumb to cover and uncover the suction control port.", isSubStep: true },
            { number: "7b4", text: "Apply suction in a circular motion as you withdraw the catheter.", isSubStep: true, warning: "Advancing the catheter too far into the back of the patient's throat may stimulate the gag reflex. This could cause vomiting and the aspiration of stomach contents." },
            { number: "7b5", text: "Suction for no longer than 10 to 15 seconds removing secretions from the back of the throat, along outer gums, cheeks, and base of tongue.", isSubStep: true },
            { number: "7b6", text: "Clear the secretions from the catheter between suctioning by inserting the tip into the saline solution and suction the solution through the catheter until the catheter is clear of secretions.", isSubStep: true, note: "If step 7b(6) is not required move to step 11." },
            { number: "7b7", text: "Repeat steps 7b(2) through 7b(6) until all secretions have been removed or until the patient's breathing becomes easier. Noisy, rattling, or gurgling sounds should no longer be heard.", isSubStep: true },
            { number: "7c", text: "Endotracheal (ET) suctioning.", isSubStep: true },
            { number: "7c1", text: "If an in-line suction catheter is not in place, attach one to the ventilator circuit after estimating the proper size by multiplying the ET tube's inner diameter by two, then selecting the next smallest size catheter.", isSubStep: true, note: "In-line suction catheters are recommended for patients receiving ventilatory support because they allow suctioning without disconnecting the patient from the ventilator and, therefore, preventing lung derecruitment, loss of oxygen, and cross-contamination." },
            { number: "7c2", text: "Attach a sterile saline ampoule to the irrigation port of the in-line suction catheter.", isSubStep: true },
            { number: "7c3", text: "Check the suction level by closing the catheter thumb port and suctioning sterile saline from the irrigation port.", isSubStep: true },
            { number: "7c4", text: "Hyper-oxygenate patient, this can either be done by the ventilator if applicable or by increasing the fraction of inspired oxygen to 100% for 2 minutes.", isSubStep: true },
            { number: "7c5", text: "Insert the catheter into the ET tube by advancing the catheter until the numbers on the suction catheter match the numbers on the ET tube that indicate the depth of insertion, resulting in the tip of the catheter only reaching the tip of the ET tube.", isSubStep: true, note: "This is called the shallow method and prevents tracheal mucosa damage.", caution: "Nerves in the trachea and carina can cause transient bradycardia and asystole. If major changes in heart rate or rhythm stop and immediately administer oxygen." },
            { number: "7c6", text: "Apply suction while withdrawing the catheter for no longer than 15 seconds.", isSubStep: true },
            { number: "7c7", text: "Clear the catheter by suctioning sterile saline from the irrigation port.", isSubStep: true },
            { number: "7c8", text: "Repeat steps 7c(1) to 7c(6) as needed.", isSubStep: true },
            { number: "7d", text: "Nasotracheal suctioning.", isSubStep: true },
            { number: "7d1", text: "Select an appropriate size suction catheter kit according to manufacturer's recommendation.", isSubStep: true },
            { number: "7d2", text: "Open the kit, using the sterile technique, and pour water-soluble lubricant into the kit.", isSubStep: true },
            { number: "7d3", text: "Don the sterile gloves supplied in the suction kit.", isSubStep: true },
            { number: "7d4", text: "Connect the thumb-control valve of the suction catheter to the vacuum tubing using your nondominant hand.", isSubStep: true, note: "The nondominant hand is now considered contaminated and should not be used to touch any sterile part of the suction catheter." },
            { number: "7d5", text: "Open the sterile water container included in the kit.", isSubStep: true },
            { number: "7d6", text: "Check suction pressure by suctioning sterile water through the catheter.", isSubStep: true },
            { number: "7d7", text: "Lubricate the catheter with water-soluble lubricant.", isSubStep: true },
            { number: "7d8", text: "Remove the non-rebreathing mask from the patient's face with your nondominant hand.", isSubStep: true },
            { number: "7d9", text: "Insert the catheter gently through the nostril, directing it toward the septum and the floor of the nasal cavity, without applying suction.", isSubStep: true, note: "If resistance is felt, gently twist the catheter; however, if resistance is still felt, withdraw the catheter, and attempt to insert it in the other nostril. Utilizing a nasopharyngeal airway will reduce mucosa damage and assists when multiple passes are necessary." },
            { number: "7d10", text: "Ask the patient to assume a \"sniffing\" position once the catheter reaches the lower pharynx.", isSubStep: true },
            { number: "7d11", text: "Continue to advance the catheter until the patient coughs or resistance is met.", isSubStep: true, note: "If resistance is met, withdraw the catheter approximately 1 centimeter." },
            { number: "7d12", text: "Apply suction for no longer than 15 seconds while simultaneously withdrawing the catheter.", isSubStep: true },
            { number: "7d13", text: "Reapply the non-rebreathing mask on the patient with your nondominant hand and hyper-oxygenate for at least one minute before attempting to suction again.", isSubStep: true },
            { number: "7d14", text: "Clear the catheter by suctioning sterile water.", isSubStep: true },
            { number: "7d15", text: "Repeat steps 7d(1) to 7d(14) as needed.", isSubStep: true },
            { number: "7d16", text: "Remove the non-rebreathing mask and return the patient to the original oxygen device, if any.", isSubStep: true },
            { number: "8", text: "Reoxygenate the patient or ventilate for at least five assisted ventilations, as appropriate." },
            { number: "9", text: "Observe the patient for signs of hypoxemia." },
            { number: "9a", text: "Signs of cyanosis.", isSubStep: true, warning: "Discontinue suctioning immediately if severe changes in color or pulse rate occur." },
            { number: "9b", text: "Increased or decreased pulse rate.", isSubStep: true },
            { number: "10", text: "Place the patient in a position of comfort." },
            { number: "11", text: "Record the procedure on the SF 600 or EMR." },
        ]
    },
    // Airway Management: Place an Intermediate Airway Device
    {
        taskNumber: "081-68W-0230",
        title: "Place an Intermediate Airway Device",
        conditions: "You are in an operational environment. You have an unconscious patient in need of a definitive airway. You will have access to Committee on Tactical Combat Casualty Care (CoTCCC), recommended intermediate airway device, gloves, syringe, stethoscope, bag valve mask (BVM), pulse oximeter, pen, clipboard, combat lifesaver qualified Soldiers, DD Form 1380 (Tactical Combat Casualty Care (TCCC) Card (Instructions)), and the patient's SF 600, (Chronological Record of Medical Care), or electronic medical record (EMR).",
        standards: "Place an intermediate airway device in accordance with PHTLS Prehospital Trauma Life Support and Tactical Combat Casualty Care (TCCC) Guidelines while adhering to all warnings and cautions without error, using the task GO/NO GO checklist.",
        caution: "All body fluids should be considered potentially infectious so always observe body substance isolation (BSI) precautions by wearing gloves and eye protection as a minimal standard of protection.",
        gradedSteps: ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22"],
        performanceSteps: [
            { number: "1", text: "Take BSI precautions." },
            { number: "2", text: "Inspect the upper airway for visible obstruction." },
            { number: "3", text: "Direct assistant to hyperventilate the patient for a minimum of 30 seconds.", note: "If using a supraglottic airway device continue with steps 3 through 16. If using a subglottic airway continue with steps 17 through 22." },
            { number: "4", text: "Test cuff and inflation system for leaks by injecting the maximum recommended volume of air into the cuffs (size 3: 60 milliliter [ml], size 4: 80 ml, size 5: 90 ml)." },
            { number: "5", text: "Remove all air from both cuffs prior to insertion." },
            { number: "6", text: "Apply lubricant to beveled distal tip and posterior aspect of the tube." },
            { number: "7", text: "Position the head in the \"sniffing\" position. Verbalize alternate position is the \"neutral\" position." },
            { number: "8", text: "Hold the supraglottic airway device at the connector with dominant hand. With nondominant hand perform a tongue and chin lift." },
            { number: "9", text: "Introduce tip into mouth and advance behind base of tongue.", note: "With the supraglottic airway device on the corner of the mouth, rotate it laterally 45-90 degrees, such that the blue orientation line is touching the corner of mouth." },
            { number: "10", text: "Pass the supraglottic airway device towards the back of tongue, rotate tube back to midline (blue orientation line faces chin)." },
            { number: "11", text: "Advance tube until base of connector is aligned with teeth or gums.", note: "Without exerting excessive force." },
            { number: "12", text: "Using the syringe provided, inflate the cuffs of the supraglottic airway device with the appropriate volume of air (size 3: 45-60 ml, size 4: 60-80 ml, size 5: 70-90 ml)." },
            { number: "13", text: "Attach the BVM to the supraglottic airway device. While gently bagging the patient to assess ventilation, simultaneously withdraw the supraglottic airway device until ventilation is easy and free flowing (large tidal volume with minimal airway pressure)." },
            { number: "14", text: "Direct the combat lifesaver to ventilate casualty with the BVM, auscultate lung fields and watch for rise and fall of the chest to confirm tube placement. Attach a pulse oximeter." },
            { number: "15", text: "Secure device to the casualty." },
            { number: "16", text: "Document information onto DD Form 1380, SF 600, or EMR." },
            { number: "17", text: "Remove subglottic airway device from the protective cradle.", note: "a. Apply lubricant on the tray of the protective cradle and lubricate the subglottic airway on all sides. b. Remove any excess lubricant.", warning: "Casualties with facial trauma or facial burns with suspected inhalation injury, an extraglottic airway (EGA) device might not be adequate. Surgical cricothyroidotomy may be a better option.", caution: "An EGA device will only be accepted if the patient is unconscious." },
            { number: "18", text: "Open the patient's airway with the head tilt chin lift.", note: "a. Use scissor technique to open the mouth. b. If patient has suspected C-spine injury use a jaw thrust." },
            { number: "19", text: "Insert the subglottic airway device by grasping the device by the bite block and introducing the leading soft tip into the mouth of the patient towards the hard palate.", note: "a. Tip of subglottic airway should be in upper esophageal opening with cuff located against laryngeal framework. b. Glide the device downwards and backwards along the hard palate with a continuous but gentle push until a definitive resistance is felt." },
            { number: "20", text: "Secure the device with tape or securing strap." },
            { number: "21", text: "Monitor end tidal carbon dioxide (CO2) and attach pulse oximeter to patient." },
            { number: "22", text: "Document information onto DD Form 1380, SF 600, or EMR." },
        ]
    },
    // Airway Management: Operate a Simplified Automated Ventilator
    {
        taskNumber: "081-68W-2001",
        title: "Operate a Simplified Automated Ventilator",
        conditions: "You are in an operational environment and have a patient requiring lifesaving ventilator support to manage acute respiratory failure. You are provided with a Simplified Automated Ventilator (SAVe) device, Rosdahl's Textbook of Basic Nursing, pen, clipboard, notepad, DD 1380 (Tactical Combat Casualty Care (TCCC) Card (Instructions)), the patient's SF 600 (Chronological Record of Medical Care), or electronic medical record.",
        standards: "Operate the SAVe maintaining adequate ventilation, in accordance with Rosdahl's Textbook of Basic Nursing, while adhering to all warnings and cautions, without error, using the task GO/NO GO checklist.",
        caution: "All body fluids should be considered potentially infectious so always observe body substance isolation precautions by wearing gloves and eye protection as a minimal standard of protection.",
        performanceSteps: [
            { number: "1", text: "Look, listen and feel for breathing and pulse.", warning: "Do not use a mask with a filter and make sure any ports on the mask are sealed with caps." },
            { number: "2", text: "Verify the airway is not blocked." },
            { number: "3", text: "Open cover labeled Patient Breathing Circuit and connect patient circuit in the well." },
            { number: "4", text: "Insert airway device.", note: "Connect the other end of the patient circuit to the airway device. Connect the other end of the patient circuit to the airway mask." },
            { number: "5", text: "Engage the SAVe and rotate the knob one position from off to the on." },
            { number: "6", text: "Open airway with head tilt chin lift or jaw thrust maneuver." },
            { number: "7", text: "Use two hands to maintain the seal of the mask.", note: "Verify adequate chest rise, feel for leaks, and listen for exhale at the valve." },
            { number: "8", text: "Verify battery life and that there are no alarms." },
            { number: "9", text: "Select six liters per minute.", note: "Supplemental oxygen: connect oxygen tube to port under the cover labeled \"O2\". Medical-grade air." },
            { number: "10", text: "Monitor the patient and alarms." },
        ]
    },
    // Airway Management: Perform a Surgical Cricothyroidotomy
    {
        taskNumber: "081-000-0122",
        title: "Perform a Surgical Cricothyroidotomy",
        conditions: "In an operational environment, you have a casualty requiring a surgical cricothyroidotomy. You have a scalpel, tracheal hook, tracheotomy tube or any non-collapsible tube, alcohol swabs, bag valve mask (BVM), stethoscope, gloves, 2x2 gauze, and tape.",
        standards: "Perform a surgical cricothyroidotomy in accordance with Tactical Combat Casualty Care (TCCC) Guidelines and Committee on Tactical Combat Casualty Care (CoTCC), while adhering to all warnings and cautions, without error, using the task GO/NO GO checklist.",
        caution: "All body fluids should be considered potentially infectious so always observe body substance isolation precautions by wearing gloves and eye protection as a minimal standard of protection.",
        performanceSteps: [
            { number: "1", text: "Don gloves.", note: "In a true emergency, there may not be time for sterile preparation of the skin.", warning: "Casualties with a total upper airway obstruction, inhalation burns, or massive maxillofacial trauma who cannot be ventilated by other means are candidates for a surgical cricothyroidotomy." },
            { number: "2", text: "Hyperextend the casualty's neck.", warning: "Do not hyperextend the casualty's neck if a cervical injury is suspected." },
            { number: "2a", text: "Place the casualty in the supine position.", isSubStep: true },
            { number: "2b", text: "Place a blanket or poncho rolled up under the casualty's neck or between the shoulder blades to hyperextend the neck.", isSubStep: true },
            { number: "3", text: "Locate the cricothyroid membrane." },
            { number: "3a", text: "Place a finger of the nondominant hand on the thyroid cartilage (Adam's apple) and slide the finger down to the cricoid cartilage.", isSubStep: true },
            { number: "3b", text: "Palpate for the soft cricothyroid membrane below the thyroid cartilage and just above the cricoid cartilage.", isSubStep: true },
            { number: "3c", text: "Slide the index finger down into the depression between the thyroid and cricoid cartilage.", isSubStep: true },
            { number: "3d", text: "Prepare the skin over the membrane with an alcohol swab.", isSubStep: true },
            { number: "4", text: "Stabilize the larynx with the nondominant hand." },
            { number: "5", text: "Perform a 1 1/2-inch vertical incision through the skin over the cricothyroid membrane with the cutting instrument in the dominant hand.", note: "A vertical incision will allow visualization of the cricothyroid membrane but keep the scalpel blade away from the lateral aspect of the neck. This is important because of the large blood vessels located in the lateral areas of the neck.", caution: "Do not cut the cricothyroid membrane with this incision." },
            { number: "6", text: "Maintain the opening of the skin incision by pulling the skin taut with the fingers of the nondominant hand." },
            { number: "7", text: "Stabilize the larynx with one hand while cutting horizontally through the cricothyroid membrane." },
            { number: "8", text: "Insert a commercially designed cricothyroidotomy hook or improvise with the tip of an 18-gauge needle.", note: "Formed into a hook through the opening, when hooking the cricoid cartilage and lifting to stabilize the opening." },
            { number: "9", text: "Insert the end of the tracheotomy tube or endotracheal tube through the opening and towards the lungs.", note: "The tube should be in the trachea and directed toward the lungs. Inflate the cuff with 10 cubic centimeters (cc) of air." },
            { number: "10", text: "Auscultate lung fields and watch for rise and fall of the chest to confirm tube placement." },
            { number: "11", text: "Assess the casualty for spontaneous respirations (10 seconds)." },
            { number: "12", text: "Attach a pulse oximeter to the casualty, if available." },
            { number: "13", text: "Assist with ventilations when respirations are less than 8 or greater than 30 or a pulse oximeter reading is less than 90%.", note: "Direct an assistant to ventilate the casualty with a BVM, if necessary." },
            { number: "14", text: "Secure the tube, using tape, cloth ties, or other measures, while applying a dressing to further protect the tube and incision." },
            { number: "15", text: "Monitor the casualty's respirations on a regular basis." },
            { number: "15a", text: "Reassess air exchange and placement every time the casualty is moved.", isSubStep: true },
            { number: "15b", text: "Assist with respirations if the respiratory rate falls below 8 or rises above 30 per minute.", isSubStep: true },
            { number: "16", text: "Document treatment on a DD Form 1380 (Tactical Combat Casualty Care (TCCC) Card (Instructions)) or the electronic medical record." },
        ]
    },
] as const
