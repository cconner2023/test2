export interface TaskTrainingData {
    taskNumber: string
    title: string
    conditions: string
    standards: string
    caution?: string
    performanceSteps: PerformanceStep[]
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






export const trainingTaskData: readonly TaskTrainingData[] = [
    // Trauma Management: Assess Patient Vital Signs
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
] as const
