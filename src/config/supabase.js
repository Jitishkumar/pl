import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Remove the duplicate import statement
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { createClient } from '@supabase/supabase-js';

// Make sure you only have one declaration of these variables
const supabaseUrl = 'https://lckhaysswueoyinhfzyz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxja2hheXNzd3Vlb3lpbmhmenl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4MzMyMTUsImV4cCI6MjA1OTQwOTIxNX0.o4Vlav3dUUuGNJzP0ndlydkPXEk9tyDVMokRaSvZrSI';

// And only one export of the supabase client
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});