// components/DischargePlan.jsx
export default function DischargePlan({ plan }) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-blue-900 mb-6">📋 Clinical Discharge Plan</h3>
      
      <div className="space-y-6">
        {/* Patient Summary */}
        {plan.patient_summary && (
          <section>
            <h4 className="font-bold text-blue-800 mb-2">Summary</h4>
            <p className="text-gray-800 leading-relaxed">{plan.patient_summary}</p>
          </section>
        )}

        {/* Discharge Diagnoses */}
        {plan.discharge_diagnoses && (
          <section>
            <h4 className="font-bold text-blue-800 mb-2">Discharge Diagnoses</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-800">
              {Array.isArray(plan.discharge_diagnoses) 
                ? plan.discharge_diagnoses.map((d, i) => <li key={i}>{d}</li>)
                : <li>{plan.discharge_diagnoses}</li>
              }
            </ul>
          </section>
        )}

        {/* Medications */}
        {plan.medications_at_discharge && (
          <section>
            <h4 className="font-bold text-blue-800 mb-2">Medications at Discharge</h4>
            <div className="bg-blue-50 p-4 rounded text-sm text-gray-800">
              {Array.isArray(plan.medications_at_discharge)
                ? plan.medications_at_discharge.map((m, i) => (
                    <p key={i} className="mb-1">{m}</p>
                  ))
                : <p>{plan.medications_at_discharge}</p>
              }
            </div>
          </section>
        )}

        {/* Follow-ups */}
        {plan.follow_up_appointments && (
          <section>
            <h4 className="font-bold text-blue-800 mb-2">Follow-up Appointments</h4>
            <div className="bg-indigo-50 p-4 rounded text-sm text-gray-800">
              {Array.isArray(plan.follow_up_appointments)
                ? plan.follow_up_appointments.map((f, i) => (
                    <p key={i} className="mb-1">• {f}</p>
                  ))
                : <p>{plan.follow_up_appointments}</p>
              }
            </div>
          </section>
        )}

        {/* Activity Restrictions */}
        {plan.activity_restrictions && (
          <section>
            <h4 className="font-bold text-blue-800 mb-2">Activity Restrictions</h4>
            <p className="text-gray-800">{plan.activity_restrictions}</p>
          </section>
        )}

        {/* Diet */}
        {plan.diet_restrictions && (
          <section>
            <h4 className="font-bold text-blue-800 mb-2">Diet</h4>
            <p className="text-gray-800">{plan.diet_restrictions}</p>
          </section>
        )}

        {/* Warning Signs */}
        {plan.warning_signs && (
          <section>
            <h4 className="font-bold text-red-800 mb-2">🚨 Warning Signs - Seek Emergency Care</h4>
            <div className="bg-red-50 p-4 rounded text-sm text-red-900">
              {Array.isArray(plan.warning_signs)
                ? plan.warning_signs.map((w, i) => (
                    <p key={i} className="mb-1">• {w}</p>
                  ))
                : <p>{plan.warning_signs}</p>
              }
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
