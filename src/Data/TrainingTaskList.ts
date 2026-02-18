export interface stp68wTrainingTypes {
  skillLevel: string,
  subjectArea: stp68wSubjectAreaTypes[]
}

export interface stp68wSubjectAreaTypes {
  name: string,
  tasks: stp68wtaskTypes[]
}
export interface stp68wtaskTypes {
  id: string,
  title: string
}

export const stp68wTraining: stp68wTrainingTypes[] =
  [
    {
      skillLevel: "Readiness Requirements",
      subjectArea: [
        {
          name: "Airway Management",
          tasks: [
            { id: "081-000-0061", title: "Perform Patient Suctioning" },
            { id: "081-68W-0230", title: "Place an Intermediate Airway Device" },
            { id: "081-68W-2001", title: "Operate a Simplified Automated Ventilator" },
            { id: "081-000-0122", title: "Perform a Surgical Cricothyroidotomy" },
            { id: "081-68W-2036", title: "Perform End Tidal Carbon Dioxide Monitoring" }
          ]
        },
        {
          name: "Fluid Management",
          tasks: [
            { id: "081-000-0128", title: "Administer Whole Blood" },
            { id: "081-68W-0237", title: "Place an Intraosseous Device" },
            { id: "081-68W-0238", title: "Manage an Intraosseous Infusion" },
            { id: "081-68W-0314", title: "Administer Fluids Through an Infusion" },
            { id: "081-68W-2000", title: "Operate a Fluid Warmer" }
          ]
        },
        {
          name: "Force Health Protection",
          tasks: [
            { id: "081-000-0059", title: "Decontaminate a Casualty" },
            { id: "081-68W-3016", title: "Brief Mission Commander on Casualty Response Plan" },
            { id: "081-68W-0167", title: "Employ Telemedicine" },
            { id: "081-000-0016", title: "Treat a Casualty for a Heat Injury" },
            { id: "081-000-0017", title: "Treat a Casualty for a Cold Injury" },
            { id: "081-68W-0005", title: "Enforce Field Sanitation Measures" }
          ]
        },
        {
          name: "Medical Management",
          tasks: [
            { id: "081-000-0072", title: "Perform a Medical Patient Assessment" },
            { id: "081-000-0114", title: "Treat a Blood Agent (Hydrogen Cyanide) Casualty" },
            { id: "081-000-0015", title: "Treat a Choking Agent Casualty" },
            { id: "081-68W-0279", title: "Treat a Biological Casualty" },
            { id: "081-000-0018", title: "Perform Basic Life Support" },
            { id: "081-000-0116", title: "Treat a Blister Agent Casualty (Mustard, Lewisite, Phosgene Oxime)" },
            { id: "081-000-0118", title: "Treat a Radiation Casualty" },
            { id: "081-68W-0275", title: "Treat a Nerve Agent Casualty" }
          ]
        },
        {
          name: "Medication Management",
          tasks: [
            { id: "081-000-0032", title: "Treat an Allergic Reaction" },
            { id: "081-000-0038", title: "Manage Intravenous Access" },
            { id: "081-000-0025", title: "Treat a Poisoned Casualty" },
            { id: "081-000-1006", title: "Administer Medication" },
            { id: "081-000-0056", title: "Prepare an Injection for Administration" },
            { id: "081-68W-0311", title: "Administer Tranexamic Acid" }
          ]
        },
        {
          name: "Trauma Management",
          tasks: [
            { id: "081-000-0037", title: "Treat a Thoracic Injury" },
            { id: "081-000-1001", title: "Assess Patient Vital Signs" },
            { id: "081-68W-0075", title: "Perform Needle Decompression of the Chest" },
            { id: "081-68W-0081", title: "Treat a Casualty with an Inguinal Wound" },
            { id: "081-68W-0091", title: "Treat a Casualty with a Neck Wound" },
            { id: "081-68W-0092", title: "Apply a Junctional Tourniquet" },
            { id: "081-68W-0231", title: "Manage Shock" },
            { id: "081-000-0023", title: "Manage a Mild Traumatic Brain Injury" },
            { id: "081-000-0040", title: "Treat a Head Injury" },
            { id: "081-000-0049", title: "Perform a Combat Casualty Assessment" },
            { id: "081-68W-0079", title: "Treat a Casualty with an Axillary Wound" }
          ]
        },
        {
          name: "Triage and Evacuation",
          tasks: [
            { id: "081-68W-0282", title: "Perform Casualty Movement" },
            { id: "081-68W-0298", title: "Transport a Casualty Using a Litter" },
            { id: "081-000-0055", title: "Perform Casualty Triage" },
            { id: "081-000-0070", title: "Establish a Casualty Collection Point" }
          ]
        }
      ]
    },
    {
      skillLevel: "Skill Level 1",
      subjectArea: [
        {
          name: "Airway Management",
          tasks: [
            { id: "081-000-0034", title: "Place an Oropharyngeal Airway" },
            { id: "081-000-0073", title: "Administer Oxygen" },
            { id: "081-68W-0236", title: "Perform End Tidal Carbon Dioxide Monitoring" },
            { id: "081-000-0125", title: "Maintain a Nasogastric Tube" },
            { id: "081-68W-0313", title: "Apply an Impedance Threshold Device" }
          ]
        },
        {
          name: "Fluid Management",
          tasks: [
            { id: "081-000-0027", title: "Measure a Patient's Fluid Balance" },
            { id: "081-000-0124", title: "Maintain Urinary Catheter" },
            { id: "081-000-3054", title: "Administer Blood Products" },
            { id: "081-68W-3054", title: "Operate an Intravenous Infusion Pump" }
          ]
        },
        {
          name: "Force Health Protection",
          tasks: [
            { id: "081-68W-0168", title: "Treat Dental Emergencies" },
            { id: "081-000-0075", title: "Perform Patient Hygiene" },
            { id: "081-68W-0169", title: "Perform Field Disinfection of Instruments" },
            { id: "081-000-0052", title: "Treat a Casualty for Insect Injury" },
            { id: "081-000-0053", title: "Treat a Snake Bite Casualty" },
            { id: "081-000-0054", title: "Manage a Patient Restraint" },
            { id: "081-000-0130", title: "Perform a Gastric Lavage" },
            { id: "081-000-0131", title: "Obtain an Electrocardiogram" },
            { id: "081-68W-0246", title: "Treat a Behavioral Emergency" }
          ]
        },
        {
          name: "Medical Management",
          tasks: [
            { id: "081-68W-0060", title: "Manage Vaginal Delivery" },
            { id: "081-68W-0170", title: "Perform Point of Care Testing" },
            { id: "081-68W-0239", title: "Treat Abdominal Disorders" },
            { id: "081-68W-0240", title: "Treat Common Eye Infections" },
            { id: "081-68W-0241", title: "Treat Common Ear Disorders" },
            { id: "081-68W-0125", title: "Treat Skin Disorders" },
            { id: "081-68W-0245", title: "Treat Common Respiratory Disorders" },
            { id: "081-68W-0254", title: "Perform an Otolaryngology Exam" },
            { id: "081-68W-0258", title: "Apply Fluorescein to an Eye" },
            { id: "081-68W-0260", title: "Treat Dislocations" },
            { id: "081-68W-0263", title: "Apply a Rigid Splint" },
            { id: "081-68W-0271", title: "Perform a Back Examination" },
            { id: "081-68W-0272", title: "Perform an Ankle Examination" },
            { id: "081-68W-0273", title: "Perform a Wrist Examination" },
            { id: "081-68W-0274", title: "Perform a Hip Examination" },
            { id: "081-000-0103", title: "Treat Common Musculoskeletal Disorders" },
            { id: "081-000-1008", title: "Obtain Specimen Collection" },
            { id: "081-68W-0063", title: "Treat a Soft Tissue Injury" },
            { id: "081-68W-0166", title: "Prevent Deep Veinous Thrombosis" },
            { id: "081-68W-0242", title: "Treat Sinus Disorder" },
            { id: "081-000-0092", title: "Perform Visual Acuity Testing" },
            { id: "081-000-0026", title: "Treat a Diabetic Emergency" },
            { id: "081-000-0068", title: "Record Patient Care Using the Subjective, Objective, Assessment, Plan (SOAP) Note Format" },
            { id: "081-000-0076", title: "Place a Patient on a Cardiac Monitor" },
            { id: "081-000-0094", title: "Remove a Patient's Ring" },
            { id: "081-000-0163", title: "Establish a Sterile Field" },
            { id: "081-000-1031", title: "Perform a Wound Irrigation" },
            { id: "081-68W-0243", title: "Treat Common Throat Disorders" },
            { id: "081-68W-0268", title: "Perform a Knee Examination" },
            { id: "081-68W-0269", title: "Perform a Shoulder Examination" },
            { id: "081-68W-0270", title: "Perform an Elbow Examination" }
          ]
        },
        {
          name: "Medication Management",
          tasks: [
            { id: "081-68W-3036", title: "Perform a Digital Block Anesthesia" },
            { id: "081-68W-3090", title: "Administer Local Anesthesia" },
            { id: "081-68W-0024", title: "Treat Paronychia" },
            { id: "081-68W-0035", title: "Treat a Patient for High Altitude Illness" }
          ]
        },
        {
          name: "Trauma Management",
          tasks: [
            { id: "081-000-3006", title: "Manage a Chest Tube" },
            { id: "081-68W-0053", title: "Perform an Emergency Medical Technician Trauma Patient Assessment" },
            { id: "081-000-0127", title: "Treat an Open Abdominal Wound" },
            { id: "081-68W-0141", title: "Apply a Traction Splint" },
            { id: "081-68W-0265", title: "Apply a Sling and Swath" },
            { id: "081-000-0005", title: "Treat a Seizing Patient" },
            { id: "081-000-0044", title: "Treat a Casualty with Burns" },
            { id: "081-000-0048", title: "Replace an Extremity Tourniquet" },
            { id: "081-000-0051", title: "Manage a Minor Laceration" },
            { id: "081-000-0083", title: "Apply a Cervical Collar" },
            { id: "081-000-0107", title: "Treat Subungual Hematoma" },
            { id: "081-000-0110", title: "Apply an Elastic Bandage" },
            { id: "081-000-0111", title: "Treat a Pelvic Injury" },
            { id: "081-000-0112", title: "Manage a Suspected Spinal Injury" },
            { id: "081-68W-0020", title: "Treat Compartment Syndrome" },
            { id: "081-68W-0021", title: "Treat Crush Injury" },
            { id: "081-68W-0036", title: "Treat a Casualty with an Impaled Object" },
            { id: "081-68W-0040", title: "Treat Eye Injuries" }
          ]
        },
        {
          name: "Triage and Evacuation",
          tasks: [
            { id: "071-334-4662", title: "Establish a Helicopter Landing Point" },
            { id: "081-000-0093", title: "Prepare an Aid Bag" },
            { id: "081-000-0151", title: "Load Casualties onto Nonstandard Vehicles" },
            { id: "081-000-0152", title: "Unload Casualties from Nonstandard Vehicles" },
            { id: "081-68W-0294", title: "Unload Patients from an Air Ambulance" },
            { id: "081-000-0088", title: "Establish an Ambulance Exchange Point" },
            { id: "081-000-1015", title: "Load Casualties onto Ground Ambulances" },
            { id: "081-000-1016", title: "Unload Casualties from Ground Ambulances" },
            { id: "081-68W-0293", title: "Load Patients on an Air Ambulance" },
            { id: "081-68W-0299", title: "Transport a Casualty Using a Modular Sled Based Rescue System or SKED® Basic Rescue System" }
          ]
        }
      ]
    },
    {
      skillLevel: "Skill Level 2",
      subjectArea: [
        {
          name: "Force Health Protection",
          tasks: [
            { id: "081-000-1030", title: "Change a Sterile Dressing" },
            { id: "081-000-0095", title: "Remove a Toenail" },
            { id: "081-68W-2004", title: "Process an Infectious Sample" }
          ]
        },
        {
          name: "Medical Management",
          tasks: [
            { id: "081-68W-2005", title: "Place an Orogastric Tube" },
            { id: "081-68W-2006", title: "Remove an Orogastric Tube" }
          ]
        },
        {
          name: "Medication Management",
          tasks: [
            { id: "081-68W-0192", title: "Treat an Abscess" }
          ]
        },
        {
          name: "Trauma Management",
          tasks: [
            { id: "081-68W-0171", title: "Perform a Focused Assessment with Sonography for Trauma Exam" }
          ]
        },
        {
          name: "Triage and Evacuation",
          tasks: [
            { id: "081-68W-2003", title: "Manage a Combat Lifesaver Program" }
          ]
        }
      ]
    },
    {
      skillLevel: "Skill Level 3",
      subjectArea: [
        {
          name: "Airway Management",
          tasks: [
            { id: "081-68W-0100", title: "Place an Endotracheal Tube" }
          ]
        },
        {
          name: "Force Health Protection",
          tasks: [
            { id: "081-68W-3008", title: "Manage a Team During Prolonged Care" },
            { id: "081-68W-3009", title: "Interpret Running Estimates Tracking" },
            { id: "081-68W-3012", title: "Manage a Unit's Medical Supply" },
            { id: "081-68W-3001", title: "Develop Annex F to Appendix 3 Medical Plan" }
          ]
        },
        {
          name: "Medical Management",
          tasks: [
            { id: "081-000-3011", title: "Treat Life Threatening Cardiac Arrhythmias" }
          ]
        },
        {
          name: "Trauma Management",
          tasks: [
            { id: "081-68W-1653", title: "Manage Canine Emergencies" }
          ]
        },
        {
          name: "Triage and Evacuation",
          tasks: [
            { id: "081-000-3058", title: "Establish a Casualty Decontamination Station" },
            { id: "081-68W-3010", title: "Coordinate Evacuation Plans" }
          ]
        }
      ]
    }
  ]
