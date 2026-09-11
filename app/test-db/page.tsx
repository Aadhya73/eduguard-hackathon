'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Student = {
  id: number
  student_id: string
  name: string
  email: string | null
  course: string | null
  semester: number | null
}

export default function TestDatabase() {
  const [students, setStudents] = useState<Student[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getStudents() {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('students')
        .select('*')

      if (error) {
        setError(error.message)
      } else {
        setStudents(data || [])
      }

      setLoading(false)
    }

    getStudents()
  }, [])

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="mb-6 text-3xl font-bold">
        Supabase Connection Test
      </h1>

      {loading && (
        <p className="text-lg">
          Connecting to Supabase...
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-red-100 p-4 text-red-700">
          <strong>Supabase Error:</strong>
          <p className="mt-2">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div>
          <p className="mb-4 font-semibold text-green-600">
            ✅ Supabase connection successful!
          </p>

          <p className="mb-6">
            Students found: <strong>{students.length}</strong>
          </p>

          {students.map((student) => (
            <div
              key={student.id}
              className="mb-4 rounded-lg border bg-white p-5 shadow"
            >
              <p>
                <strong>Name:</strong> {student.name}
              </p>

              <p>
                <strong>Student ID:</strong> {student.student_id}
              </p>

              <p>
                <strong>Email:</strong> {student.email || 'N/A'}
              </p>

              <p>
                <strong>Course:</strong> {student.course || 'N/A'}
              </p>

              <p>
                <strong>Semester:</strong> {student.semester || 'N/A'}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}