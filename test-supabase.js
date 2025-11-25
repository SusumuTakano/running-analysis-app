import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fiertkuxlafeeqycywjh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpZXJ0a3V4bGFmZWVxeWN5d2poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyNzc5MzAsImV4cCI6MjA1OTg1MzkzMH0.VB4afTl9wLxtdodrf7klAyCQIVMuLc2I1gRwh1v23tg'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log('Testing Supabase connection...')
console.log('URL:', supabaseUrl)

// Test basic connection
const testConnection = async () => {
  try {
    console.log('\n1. Testing auth health...')
    const { data, error } = await supabase.auth.getSession()
    console.log('Auth session result:', error ? error.message : 'OK')
    
    console.log('\n2. Testing database query...')
    const { data: testData, error: dbError } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1)
    
    console.log('Database query result:', dbError ? dbError.message : 'OK')
    
    console.log('\nConnection test completed!')
  } catch (err) {
    console.error('Test failed:', err)
  }
}

testConnection()
