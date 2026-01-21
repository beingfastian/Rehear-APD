export const recentActivity = [
  { id: 1, name: 'lecture_notes_01.mp3', type: 'Full Transcription', duration: '12:45', status: 'Completed' },
  { id: 2, name: 'lecture_notes_02.mp3', type: 'Segmented Chunks', duration: '07:34', status: 'Processing' },
  { id: 3, name: 'lecture_notes_03.mp3', type: 'Full Transcription', duration: '15:20', status: 'Completed' },
  { id: 4, name: 'lecture_notes_04.mp3', type: 'Full Transcription', duration: '08:15', status: 'Completed' }
];

export const allRecordings = [
  { id: 1, name: 'lecture_notes_01.mp3', type: 'Full Transcription', duration: '12:45', status: 'Completed' },
  { id: 2, name: 'lecture_notes_02.mp3', type: 'Segmented Chunks', duration: '07:34', status: 'Processing' },
  { id: 3, name: 'lecture_notes_03.mp3', type: 'Segmented Chunks', duration: '07:33', status: 'Processing' },
  { id: 4, name: 'lecture_notes_04.mp3', type: 'Segmented Chunks', duration: '10:23', status: 'Processing' },
  { id: 5, name: 'lecture_notes_05.mp3', type: 'Segmented Chunks', duration: '09:12', status: 'Processing' },
  { id: 6, name: 'lecture_notes_06.mp3', type: 'Full Transcription', duration: '12:45', status: 'Completed' }
];

export const transcriptSegments = [
  { id: 1, timestamp: '00:15', text: 'Welcome everyone to organic chemistry.', isInstruction: false },
  { id: 2, timestamp: '01:12', text: 'Open your textbook to page 45.', isInstruction: true },
  { id: 3, timestamp: '02:40', text: 'Now we look at how polymers link.', isInstruction: false }
];

export const learningModules = [
  { id: 1, title: 'Visual Analysis', step: 'Step 1: Open your textbooks', audioFile: 'audio1.mp3' },
  { id: 2, title: 'Visual Analysis', step: 'Step 2: Identify bond', audioFile: 'audio2.mp3' }
];
