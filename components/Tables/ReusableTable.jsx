import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Typography,
  Box,
  TablePagination,
  CircularProgress,
  InputAdornment,
  Card,
  CardContent,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  KeyboardArrowUp,
  KeyboardArrowDown,
  Remove as RemoveIcon
} from '@mui/icons-material';

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: '16px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
  border: '1px solid #e3f2fd',
  overflow: 'hidden',
  background: '#ffffff',
}));

const StyledTableHead = styled(TableHead)(({ theme }) => ({
  background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 50%, #0d47a1 100%)',
  '& .MuiTableCell-head': {
    color: 'black',
    fontWeight: 700,
    fontSize: '0.875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    borderBottom: '1px solid #1565c0',
    padding: '20px 24px',
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '2px',
      background: 'rgba(255, 255, 255, 0.2)',
    },
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  position: 'relative',
  '&:nth-of-type(even)': {
    backgroundColor: '#fafafa',
  },
  '&:hover': {
    backgroundColor: '#e3f2fd',
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 20px rgba(25, 118, 210, 0.15)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '& .MuiTableCell-body': {
      borderBottom: '1px solid #bbdefb',
    },
  },
  '& .MuiTableCell-body': {
    padding: '20px 24px',
    borderBottom: '1px solid #e0e0e0',
    fontSize: '0.875rem',
    color: '#424242',
    transition: 'all 0.2s ease',
  },
}));

const HeaderCard = styled(Card)(({ theme }) => ({
  marginBottom: '32px',
  borderRadius: '16px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  border: '1px solid #e3f2fd',
  background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
}));

const SearchField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.2s ease',
    '& fieldset': {
      borderColor: '#e0e0e0',
      borderWidth: '1px',
    },
    '&:hover fieldset': {
      borderColor: '#1976d2',
      boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#1976d2',
      borderWidth: '2px',
      boxShadow: '0 0 0 4px rgba(25, 118, 210, 0.1)',
    },
  },
  '& .MuiInputBase-input': {
    padding: '14px 16px',
    fontSize: '0.875rem',
  },
}));

const ActionButton = styled(IconButton)(({ theme, actioncolor }) => ({
  margin: '0 4px',
  padding: '10px',
  borderRadius: '10px',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  border: '1px solid transparent',
  ...(actioncolor === 'primary' && {
    color: '#1976d2',
    '&:hover': {
      backgroundColor: '#e3f2fd',
      borderColor: '#bbdefb',
      transform: 'scale(1.1) translateY(-1px)',
      boxShadow: '0 4px 12px rgba(25, 118, 210, 0.2)',
    },
  }),
  ...(actioncolor === 'success' && {
    color: '#2e7d32',
    '&:hover': {
      backgroundColor: '#e8f5e8',
      borderColor: '#c8e6c9',
      transform: 'scale(1.1) translateY(-1px)',
      boxShadow: '0 4px 12px rgba(46, 125, 50, 0.2)',
    },
  }),
  ...(actioncolor === 'error' && {
    color: '#d32f2f',
    '&:hover': {
      backgroundColor: '#ffebee',
      borderColor: '#ffcdd2',
      transform: 'scale(1.1) translateY(-1px)',
      boxShadow: '0 4px 12px rgba(211, 47, 47, 0.2)',
    },
  }),
  ...((!actioncolor || actioncolor === 'default') && {
    color: '#616161',
    '&:hover': {
      backgroundColor: '#f5f5f5',
      borderColor: '#e0e0e0',
      transform: 'scale(1.1) translateY(-1px)',
      boxShadow: '0 4px 12px rgba(97, 97, 97, 0.2)',
    },
  }),
}));

const AddButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.875rem',
  padding: '12px 24px',
  background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 50%, #0d47a1 100%)',
  boxShadow: '0 4px 16px rgba(25, 118, 210, 0.3)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  '&:hover': {
    background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 50%, #01579b 100%)',
    boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
    transform: 'translateY(-2px)',
  },
  '&:active': {
    transform: 'translateY(0px)',
  },
}));

const SortableHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  userSelect: 'none',
  padding: '4px 0',
  borderRadius: '6px',
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: 'translateY(-1px)',
  },
}));

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: '80px 20px',
  color: '#757575',
  background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '80px 20px',
  flexDirection: 'column',
  gap: '20px',
  background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
}));

const PaginationContainer = styled(Box)(({ theme }) => ({
  padding: '20px 24px',
  backgroundColor: '#f8f9ff',
  borderTop: '1px solid #e3f2fd',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '16px',
}));

const ReusableTable = ({
  data,
  columns,
  actions = [],
  isLoading = false,
  error = null,
  searchable = true,
  searchPlaceholder = "Search...",
  paginated = true,
  pageSize = 10,
  pageSizeOptions = [5, 10, 25, 50],
  title,
  subtitle,
  addButton,
  emptyMessage = "No records to display",
  emptyIcon = <RemoveIcon sx={{ fontSize: 64, color: '#bdbdbd', mb: 2 }} />,
  className = ""
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [sortConfig, setSortConfig] = useState(null);

  // Get searchable columns
  const searchableColumns = useMemo(() => 
    columns.filter(col => col.searchable !== false), 
    [columns]
  );

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery || !searchable) return data;
    
    return data.filter(row =>
      searchableColumns.some(column =>
        String(row[column.key])
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      )
    );
  }, [data, searchQuery, searchableColumns, searchable]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredData, sortConfig]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!paginated) return sortedData;
    
    const startIndex = page * rowsPerPage;
    return sortedData.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedData, page, rowsPerPage, paginated]);

  // Handle sorting
  const handleSort = (columnKey) => {
    const column = columns.find(col => col.key === columnKey);
    if (!column?.sortable) return;

    setSortConfig(prev => {
      if (prev?.key === columnKey) {
        return prev.direction === 'asc' 
          ? { key: columnKey, direction: 'desc' }
          : null;
      }
      return { key: columnKey, direction: 'asc' };
    });
  };

  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle search
  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setPage(0);
  };

  if (isLoading) {
    return (
      <Paper className={className} sx={{ borderRadius: '16px', overflow: 'hidden' }}>
        <LoadingContainer>
          <CircularProgress size={48} sx={{ color: '#1976d2' }} />
          <Typography variant="h6" color="textSecondary" sx={{ fontWeight: 500 }}>
            Loading data...
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Please wait while we fetch your data
          </Typography>
        </LoadingContainer>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper className={className} sx={{ borderRadius: '16px', overflow: 'hidden' }}>
        <LoadingContainer>
          <Typography variant="h5" color="error" gutterBottom sx={{ fontWeight: 600 }}>
            ⚠️ Error Loading Data
          </Typography>
          <Typography variant="body1" color="textSecondary" sx={{ textAlign: 'center', maxWidth: 400 }}>
            {error}
          </Typography>
          <Button 
            variant="outlined" 
            color="primary" 
            sx={{ mt: 2 }}
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </LoadingContainer>
      </Paper>
    );
  }

  return (
    <Box className={className}>
      {/* Header */}
      {(title || subtitle || searchable || addButton) && (
        <HeaderCard>
          <CardContent sx={{ padding: '32px !important' }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
              <Box>
                {title && (
                  <Typography 
                    variant="h4" 
                    component="h2" 
                    gutterBottom 
                    sx={{ 
                      fontWeight: 800, 
                      color: '#1a1a1a',
                      background: 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      fontSize: '1.75rem',
                      letterSpacing: '-0.5px',
                    }}
                  >
                    {title}
                  </Typography>
                )}
                {subtitle && (
                  <Typography variant="body1" color="textSecondary" sx={{ fontSize: '1rem', lineHeight: 1.6 }}>
                    {subtitle}
                  </Typography>
                )}
              </Box>
              
              {addButton && (
                <AddButton
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={addButton.onClick}
                >
                  {addButton.label}
                </AddButton>
              )}
            </Box>
            
            {searchable && (
              <Box display="flex" gap={2} alignItems="center">
                <SearchField
                  fullWidth
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={handleSearchChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#9e9e9e', fontSize: '1.25rem' }} />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery && (
                      <InputAdornment position="end">
                        <IconButton 
                          onClick={handleClearSearch} 
                          size="small"
                          sx={{ 
                            color: '#9e9e9e',
                            '&:hover': { 
                              backgroundColor: '#f5f5f5',
                              color: '#1976d2' 
                            }
                          }}
                        >
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            )}
          </CardContent>
        </HeaderCard>
      )}

      {/* Table */}
      <StyledTableContainer component={Paper}>
        <Table stickyHeader>
          <StyledTableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align || 'left'}
                  style={{ width: column.width }}
                >
                  {column.sortable ? (
                    <SortableHeader onClick={() => handleSort(column.key)}>
                      <Typography variant="inherit" component="span" sx={{ fontWeight: 'inherit' }}>
                        {column.label}
                      </Typography>
                      <Box ml={1} display="flex" flexDirection="column">
                        <KeyboardArrowUp 
                          sx={{ 
                            fontSize: 18, 
                            opacity: sortConfig?.key === column.key && sortConfig.direction === 'asc' ? 1 : 0.4,
                            transition: 'opacity 0.2s'
                          }} 
                        />
                        <KeyboardArrowDown 
                          sx={{ 
                            fontSize: 18, 
                            opacity: sortConfig?.key === column.key && sortConfig.direction === 'desc' ? 1 : 0.4,
                            transition: 'opacity 0.2s',
                            mt: -0.75
                          }} 
                        />
                      </Box>
                    </SortableHeader>
                  ) : (
                    <Typography variant="inherit" component="span" sx={{ fontWeight: 'inherit' }}>
                      {column.label}
                    </Typography>
                  )}
                </TableCell>
              ))}
              {actions.length > 0 && (
                <TableCell align="center">
                  <Typography variant="inherit" component="span" sx={{ fontWeight: 'inherit' }}>
                    Actions
                  </Typography>
                </TableCell>
              )}
            </TableRow>
          </StyledTableHead>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, index) => (
                <StyledTableRow key={index}>
                  {columns.map((column) => (
                    <TableCell 
                      key={column.key} 
                      align={column.align || 'left'}
                    >
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </TableCell>
                  ))}
                  {actions.length > 0 && (
                    <TableCell align="center">
                      <Box display="flex" justifyContent="center" alignItems="center">
                        {actions.map((action, actionIndex) => {
                          if (action.show && !action.show(row)) return null;
                          
                          return (
                            <Tooltip key={actionIndex} title={action.label} arrow>
                              <ActionButton
                                actioncolor={action.color || 'default'}
                                onClick={() => action.onClick(row)}
                                size="small"
                              >
                                {action.icon}
                              </ActionButton>
                            </Tooltip>
                          );
                        })}
                      </Box>
                    </TableCell>
                  )}
                </StyledTableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length + (actions.length > 0 ? 1 : 0)}>
                  <EmptyState>
                    {emptyIcon}
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#616161' }}>
                      {emptyMessage}
                    </Typography>
                    {searchQuery && (
                      <Typography variant="body1" color="textSecondary" sx={{ mt: 1 }}>
                        Try adjusting your search terms or clear the search to see all records
                      </Typography>
                    )}
                  </EmptyState>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {paginated && sortedData.length > 0 && (
          <PaginationContainer>
            <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 500 }}>
              Showing {page * rowsPerPage + 1} to{' '}
              {Math.min((page + 1) * rowsPerPage, sortedData.length)} of{' '}
              {sortedData.length} entries
              {searchQuery && ` (filtered from ${data.length} total entries)`}
            </Typography>
            <TablePagination
              component="div"
              count={sortedData.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={pageSizeOptions}
              sx={{
                '& .MuiTablePagination-toolbar': {
                  paddingLeft: 0,
                  paddingRight: 0,
                },
                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                  fontSize: '0.875rem',
                  color: '#616161',
                  fontWeight: 500,
                },
                '& .MuiTablePagination-select': {
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e0e0e0',
                  '&:focus': {
                    borderColor: '#1976d2',
                    backgroundColor: '#ffffff',
                  },
                },
                '& .MuiIconButton-root': {
                  borderRadius: '8px',
                  '&:hover': {
                    backgroundColor: '#e3f2fd',
                  },
                },
              }}
            />
          </PaginationContainer>
        )}
      </StyledTableContainer>
    </Box>
  );
};

export default ReusableTable;