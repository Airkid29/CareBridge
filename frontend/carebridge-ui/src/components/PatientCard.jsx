// components/PatientCard.jsx
export default function PatientCard({ patient }) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 col-span-1 lg:col-span-3">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Patient Info</h3>
          <p className="text-2xl font-bold text-gray-900">{patient.name}</p>
          <p className="text-gray-600">{patient.age} years old</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Diagnosis</h3>
          <p className="text-lg font-semibold text-blue-700">{patient.diagnosis}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Conditions</h3>
          <div className="space-y-1">
            {patient.conditions.map((cond, i) => (
              <p key={i} className="text-sm text-gray-700">• {cond}</p>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Allergies</h3>
          <div className="space-y-1">
            {patient.allergies.map((allergy, i) => (
              <p key={i} className="text-sm text-red-700 font-semibold">⚠️ {allergy}</p>
            ))}
          </div>
        </div>

      </div>

      {/* Medications Table */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">Current Medications</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-gray-700">Medication</th>
                <th className="px-3 py-2 text-left text-gray-700">Dose</th>
                <th className="px-3 py-2 text-left text-gray-700">Frequency</th>
              </tr>
            </thead>
            <tbody>
              {patient.medications.map((med, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-semibold text-gray-900">{med.name}</td>
                  <td className="px-3 py-2 text-gray-700">{med.dose}</td>
                  <td className="px-3 py-2 text-gray-700">{med.frequency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Labs */}
      {patient.labs && (
        <div className="mt-6 p-4 bg-yellow-50 rounded">
          <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">Lab Results</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(patient.labs).map(([key, value]) => (
              <div key={key} className="text-sm">
                <p className="text-gray-600">{key.replace(/_/g, ' ')}</p>
                <p className="font-bold text-yellow-700">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
