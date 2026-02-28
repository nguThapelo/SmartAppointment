import React, { useState } from 'react';
import Users from '@/components/Users/Users';
import DictionaryExample from '@/components/Tables/DictionaryExample';

const tabContents = [
  { label: "Tab 1", title: "Content for Tab 1", content: <Users /> },
  { label: "Tab 2", title: "Content for Tab 2", content: <DictionaryExample /> },
  { label: "Tab 3", title: "Content for Tab 3", content: "Here is some content for the third tab." },
];

const Library = () => {
  const [value, setValue] = useState(0);

  const handleChange = (newValue) => {
    setValue(newValue);
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Library</h1>
          <p className="text-sm text-slate-600">Browse reusable examples and management components.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Components ready
        </span>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabContents.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => handleChange(index)}
            className={`app-tab ${value === index ? 'app-tab-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabContents.map((tab, index) => (
        <div key={tab.label} className={`${value === index ? 'block' : 'hidden'} app-card-tight`}>
          <h2 className="text-base font-semibold text-slate-900">{tab.title}</h2>
          <div className="mt-3">{tab.content}</div>
        </div>
      ))}
    </section>
  );
};

export default Library;