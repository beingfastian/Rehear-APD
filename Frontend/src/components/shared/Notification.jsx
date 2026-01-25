// Frontend/src/components/shared/Notification.jsx

import React from 'react';
import { CheckCircle, XCircle, Info, AlertCircle } from 'lucide-react';

const Notification = ({ message, type = 'info', onClose }) => {
  if (!message) return null;

  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      iconColor: 'text-green-600',
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
    },
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-600',
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-600',
    },
  };

  const { icon: Icon, bgColor, borderColor, textColor, iconColor } = config[type];

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-50 animate-slide-in">
      <div className={`${bgColor} border ${borderColor} rounded-lg p-3 sm:p-4 shadow-lg max-w-md mx-auto sm:mx-0 flex items-start gap-2 sm:gap-3`}>
        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs sm:text-sm font-medium ${textColor}`}>{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`${textColor} hover:opacity-70 transition-opacity flex-shrink-0`}
          >
            <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Notification;