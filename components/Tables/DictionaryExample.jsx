import React, { useState } from 'react';
import { Visibility, Edit, Delete } from '@mui/icons-material';
import { Chip } from '@mui/material';
import ReusableTable from './ReusableTable'; 

// Sample data
const sampleData = [
  {
    id: 1,
    acronym: "API",
    definition: "Application Programming Interface",
    category: "Technology",
    dateAdded: "2024-01-15"
  },
  {
    id: 2,
    acronym: "UI",
    definition: "User Interface",
    category: "Design",
    dateAdded: "2024-01-16"
  },
  {
    id: 3,
    acronym: "UX",
    definition: "User Experience",
    category: "Design",
    dateAdded: "2024-01-17"
  },
  {
    id: 4,
    acronym: "REST",
    definition: "Representational State Transfer",
    category: "Technology",
    dateAdded: "2024-01-18"
  },
  {
    id: 5,
    acronym: "HTTP",
    definition: "HyperText Transfer Protocol",
    category: "Technology",
    dateAdded: "2024-01-19"
  },
  {
    id: 6,
    acronym: "CSS",
    definition: "Cascading Style Sheets",
    category: "Technology",
    dateAdded: "2024-01-20"
  },
  {
    id: 7,
    acronym: "HTML",
    definition: "HyperText Markup Language",
    category: "Technology",
    dateAdded: "2024-01-21"
  },
  {
    id: 8,
    acronym: "JSON",
    definition: "JavaScript Object Notation",
    category: "Technology",
    dateAdded: "2024-01-22"
  }
];

const DictionaryExample = () => {
  const [data, setData] = useState(sampleData);
  const [isLoading] = useState(false);


  const columns = [
    {
      key: 'acronym',
      label: 'Acronym',
      sortable: true,
      searchable: true,
      width: 150,
      render: (value) => (
        <span style={{ 
          fontWeight: 700, 
          color: 'var(--app-nav-link-text)',
          fontSize: '1rem',
          letterSpacing: '0.5px'
        }}>
          {value}
        </span>
      )
    },
    {
      key: 'definition',
      label: 'Definition',
      sortable: true,
      searchable: true,
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      searchable: true,
      width: 140,
      align: 'center',
      render: (value) => (
        <Chip
          label={value}
          size="small"
          sx={{
            backgroundColor: value === 'Technology' ? 'var(--app-nav-link-hover-bg)' : 'var(--app-pill-bg)',
            color: value === 'Technology' ? 'var(--app-nav-link-text)' : 'var(--app-pill-text)',
            fontWeight: 600,
            fontSize: '0.75rem',
            borderRadius: '16px',
            border: value === 'Technology' ? '1px solid var(--app-nav-link-active-border)' : '1px solid var(--app-pill-border)',
          }}
        />
      )
    },
    {
      key: 'dateAdded',
      label: 'Date Added',
      sortable: true,
      width: 140,
      align: 'center',
      render: (value) => (
        <span style={{ 
          color: 'var(--app-input-text)',
          fontSize: '0.875rem',
          fontWeight: 500
        }}>
          {new Date(value).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </span>
      )
    }
  ];

  // Define table actions
  const actions = [
    {
      label: 'View Details',
      icon: <Visibility fontSize="small" />,
      color: 'primary',
      onClick: (row) => {
        alert(`Viewing: ${row.acronym} - ${row.definition}`);
      }
    },
    {
      label: 'Edit Entry',
      icon: <Edit fontSize="small" />,
      color: 'success',
      onClick: (row) => {
        alert(`Editing: ${row.acronym}`);
      }
    },
    {
      label: 'Delete Entry',
      icon: <Delete fontSize="small" />,
      color: 'error',
      onClick: (row) => {
        if (window.confirm(`Are you sure you want to delete "${row.acronym}"?`)) {
          setData(prevData => prevData.filter(item => item.id !== row.id));
        }
      }
    }
  ];

  const handleAddEntry = () => {
    const newEntry = {
      id: Date.now(),
      acronym: "NEW",
      definition: "New Entry Example",
      category: "Technology",
      dateAdded: new Date().toISOString().split('T')[0]
    };
    setData(prevData => [newEntry, ...prevData]);
  };

  return (
    <div className="app-card-tight">
      <ReusableTable
        data={data}
        columns={columns}
        actions={actions}
        isLoading={isLoading}
        title="Dictionary Management System"
        subtitle="Manage and organize your technical acronyms and definitions"
        searchPlaceholder="Search by acronym, definition, or category..."
        addButton={{
          label: "Add New Entry",
          onClick: handleAddEntry
        }}
        pageSize={5}
        pageSizeOptions={[5, 10, 15, 20]}
        className="dictionary-table"
        emptyMessage="No dictionary entries found"
      />
    </div>
  );
};

export default DictionaryExample;