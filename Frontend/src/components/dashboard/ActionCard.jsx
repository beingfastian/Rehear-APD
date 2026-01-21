import React from 'react';

const ActionCard = ({ icon: Icon, title, description, buttonText, buttonVariant = 'default', onClick }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 text-center hover:shadow-lg transition-shadow cursor-pointer">
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <Icon className="w-6 h-6 text-gray-600" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      <button 
        onClick={onClick}
        className={`px-4 py-2 rounded-lg text-sm font-medium ${
          buttonVariant === 'primary' 
            ? 'bg-blue-500 text-white hover:bg-blue-600' 
            : 'border border-gray-300 hover:bg-gray-50'
        }`}
      >
        {buttonText}
      </button>
    </div>
  );
};

export default ActionCard;