import React, { useState } from 'react';
import { Button, Table, TableBody, Typography, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, TablePagination, Box } from '@mui/material';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import UsersForm from '@/components/Users/AddUsersForm';
import DialogForm from '@/components/General/DialogForm';

const Users = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [users] = useState([
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    { id: 3, name: 'Mike Johnson', email: 'mike@example.com' },
  ]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleDialogOpen = () => {
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-3">
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} mb={2}>
        <TextField
          label="Search"
          placeholder='Search by user name'
          variant="outlined"
          value={searchQuery}
          onChange={handleSearchChange}
          fullWidth
          sx={{
            '& .MuiInputLabel-root': {
              color: 'var(--app-input-text)',
            },
            '& .MuiOutlinedInput-root': {
              borderRadius: 'var(--app-control-radius)',
              minHeight: 'var(--app-control-height)',
              color: 'var(--app-input-text)',
              background: 'var(--app-input-bg)',
              '& fieldset': {
                borderColor: 'var(--app-input-border)',
              },
              '&:hover fieldset': {
                borderColor: 'var(--app-input-focus-border)',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'var(--app-input-focus-border)',
              },
            },
          }}
        />
        <Button
          variant="outlined"
          onClick={handleClearSearch}
          startIcon={<SearchOffIcon />}
          sx={{
            minHeight: 'var(--app-control-height)',
            px: 2,
            borderRadius: 'var(--app-control-radius)',
            borderColor: 'var(--app-input-border)',
            color: 'var(--app-input-text)',
            '&:hover': {
              borderColor: 'var(--app-input-focus-border)',
              backgroundColor: 'var(--app-nav-link-hover-bg)',
            },
          }}
        >
          Clear
        </Button>
      </Box>
      <Box display="flex" justifyContent="flex-end" mb={2}>
        <Button
          variant="contained"
          onClick={handleDialogOpen}
          sx={{
            borderRadius: 'var(--app-control-radius)',
            minHeight: 'var(--app-control-height)',
            backgroundColor: 'var(--app-primary-btn-bg)',
            color: 'var(--app-primary-btn-text)',
            px: 2,
            '&:hover': {
              backgroundColor: 'var(--app-primary-btn-hover)',
            },
          }}
        >
          Add User
        </Button>
      </Box>
      <DialogForm
        title="Add User"
        content={<UsersForm />}
        open={isDialogOpen}
        onClose={handleDialogClose}
      />
      <TableContainer component={Paper} className="app-card-tight">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.length > 0 ? (
              filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(user => (
                <TableRow key={user.id} sx={{ '&:hover': { backgroundColor: 'var(--app-nav-link-hover-bg)' } }}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography variant="body1" color="textSecondary">
                    No records to display
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <div>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredUsers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </div>
    </div>
  );
};

export default Users;