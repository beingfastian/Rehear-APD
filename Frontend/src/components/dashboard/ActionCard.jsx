import React from 'react';

const ActionCard = ({ icon: Icon, title, description, buttonText, buttonVariant = 'default', onClick }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 text-center hover:shadow-lg transition-shadow cursor-pointer">
      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base">{title}</h3>
      <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">{description}</p>
      <button 
        onClick={onClick}
        className={`w-full sm:w-auto px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium ${
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