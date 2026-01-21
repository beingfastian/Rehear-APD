import React from 'react';
import { FileText, Mic, Upload } from 'lucide-react';
import WelcomeCard from '../components/dashboard/WelcomeCard';
import ActionCard from '../components/dashboard/ActionCard';
import RecentActivityTable from '../components/dashboard/RecentActivityTable';
import { recentActivity } from '../data/sampleData';

const Dashboard = () => {
  const actionCards = [
    {
      icon: FileText,
      title: 'Instructional Chunks',
      description: 'Files logged down and neatly split into bite-size AI-styled learning units.',
      buttonText: 'View Chunks',
      buttonVariant: 'default'
    },
    {
      icon: Mic,
      title: 'Live Record',
      description: 'Capture audio directly from your device (laptop or mic).',
      buttonText: 'Start Recording',
      buttonVariant: 'default'
    },
    {
      icon: Upload,
      title: 'Upload Audio',
      description: 'Support for WAV, MP3, and M4A. Accepts up to 200MB.',
      buttonText: 'Upload file',
      buttonVariant: 'primary'
    }
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Dashboard Overview
      </h1>

      <WelcomeCard />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {actionCards.map((card, index) => (
          <ActionCard key={index} {...card} />
        ))}
      </div>

      <RecentActivityTable data={recentActivity} />
    </div>
  );
};

export default Dashboard;
