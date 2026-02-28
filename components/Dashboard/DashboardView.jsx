import DialogForm from '@/components/General/DialogForm';
import InfoCard from "@/components/General/InfoCard";
import PageHeader from "@/components/General/PageHeader";
import BarGraph from '@/components/Statistics/BarGraph';
import PieChart from '@/components/Statistics/PieChart';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { Box, Button, Grid, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField } from "@mui/material";
import axios from 'axios';
import { useState } from 'react';
import { FaRegFileWord } from "react-icons/fa6";
import { MdOutlineAdsClick } from "react-icons/md";
import { FaRegFilePdf } from "react-icons/fa6";


const DashboardView = () => {

    const dummyData = [
        { user: 'John Doe', age: 28, transactions: 5, totalAmount: 1500 },
      ];

    const [searchTerm, setSearchTerm] = useState('');
    const [order, setOrder] = useState('asc');
    const [orderBy, setOrderBy] = useState('user');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5); 
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogTitle, setDialogTitle] = useState('');  
    
    const handleIconClick = (title) => {
        setDialogTitle(title);
        setDialogOpen(true);
      };
    
      const handleClose = () => {
        setDialogOpen(false);
      };

    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
      };
    
      const handleClearSearch = () => {
        setSearchTerm('');
      };
    
      const handleRequestSort = (event, property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
      };
    
      const handleChangePage = (event, newPage) => {
        setPage(newPage);
      };
    
      const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
      };
    
      const filteredData = dummyData.filter((row) =>
        row.user.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
      const sortedData = filteredData.sort((a, b) => {
        if (orderBy === 'user') {
          return order === 'asc'
            ? a.user.localeCompare(b.user)
            : b.user.localeCompare(a.user);
        } else {
          return order === 'asc'
            ? a[orderBy] - b[orderBy]
            : b[orderBy] - a[orderBy];
        }
      });

      const paginatedData = sortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

      const handleDownload = async (UserData, Type) => {
        try {
          const url = "/api/GenWordReport";
          const response = await axios.post(
            url,
            { userData: UserData, Type: "DOCX" }, 
            { responseType: "blob" }
          );
      
          const docxBlob = new Blob([response.data], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });
      
          if (Type === "DOCX") {
            // Download DOCX directly
            const downloadUrl = window.URL.createObjectURL(docxBlob);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.setAttribute("download", `${UserData.user}_report.docx`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
          } else if (Type === "PDF") {

          }
        } catch (error) {
          console.error("Error downloading file:", error);
        }
      };
    

  return (
    <div style={{ padding: "20px" }}>
      <PageHeader/>

      <Grid container spacing={3}>
        {/* Info Cards */}
        
          <Grid item xs={12} md={3} key="Total1">
            <InfoCard
              header={
                <>
                  <MdOutlineAdsClick
                    style={{ marginRight: "8px", verticalAlign: 'middle', position: 'relative', top: '-2px', cursor: 'pointer' }}
                    onClick={() => handleIconClick('Card 1')}
                  />
                  1
                </>
              }
              innerText="10"
            />
          </Grid>
          <Grid item xs={12} md={3} key="Total2">
            <InfoCard
              header={
                <>
                  <MdOutlineAdsClick
                    style={{ marginRight: "8px", verticalAlign: 'middle', position: 'relative', top: '-2px', cursor: 'pointer' }}
                    onClick={() => handleIconClick('Card 2')}
                  />
                  2
                </>
              }
              innerText="20"
            />
          </Grid>
          <Grid item xs={12} md={3} key="Total3">
            <InfoCard
              header={
                <>
                  <MdOutlineAdsClick
                    style={{ marginRight: "8px", verticalAlign: 'middle', position: 'relative', top: '-2px', cursor: 'pointer' }}
                    onClick={() => handleIconClick('Card 3')}
                  />
                  3
                </>
              }
              innerText="30"
            />
          </Grid>
          <Grid item xs={12} md={3} key="Total4">
            <InfoCard
              header={
                <>
                  <MdOutlineAdsClick
                    style={{ marginRight: "8px", verticalAlign: 'middle', position: 'relative', top: '-2px', cursor: 'pointer' }}
                    onClick={() => handleIconClick('Card 4')}
                  />
                  4
                </>
              }
              innerText="40"
            />
          </Grid>

        {/* Charts */}
        <Grid item xs={12} md={6}>
          <InfoCard
            header="Chart 1"
            innerText={
              <BarGraph />
            }
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <InfoCard
            header="Chart 2"
            innerText={
                <PieChart />
              }
          />
        </Grid>

        <Grid item xs={12} md={12}>
            <InfoCard
              header="Table Info"
              innerText={
                <Box p={2}>
                  <Box p={2} display="flex" alignItems="center">
                    <TextField
                      label="Search"
                      placeholder='Search by User Name'
                      variant="outlined"
                      value={searchTerm}
                      onChange={handleSearchChange}
                      fullWidth
                      style={{ marginRight: '20px' }}
                      InputProps={{
                        style: {
                          height: '40px',
                        },
                      }}
                      InputLabelProps={{
                        shrink: true,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': {
                            borderColor: '#550000',
                          },
                          '&:hover fieldset': {
                            borderColor: '#ff0000',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#550000',
                          },
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={handleClearSearch}
                      startIcon={<SearchOffIcon sx={{ color: '#550000' }} />}
                      sx={{
                        height: '40px',
                        backgroundColor: 'white',
                        border: '1px solid #550000',
                        color: '#550000',
                        '&:hover': {
                          backgroundColor: 'white',
                          border: '1px solid #ff0000',
                          color: '#ff0000',
                        },
                      }}
                    >
                      Clear
                    </Button>
                  </Box>
                  <TableContainer component={Paper} style={{ maxHeight: 400 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            <TableSortLabel
                              active={orderBy === 'user'}
                              direction={orderBy === 'user' ? order : 'asc'}
                              onClick={(event) => handleRequestSort(event, 'user')}
                            >
                              User
                            </TableSortLabel>
                          </TableCell>
                          <TableCell align="right">
                            <TableSortLabel
                              active={orderBy === 'age'}
                              direction={orderBy === 'age' ? order : 'asc'}
                              onClick={(event) => handleRequestSort(event, 'age')}
                            >
                              Age
                            </TableSortLabel>
                          </TableCell>
                          <TableCell align="right">
                            <TableSortLabel
                              active={orderBy === 'transactions'}
                              direction={orderBy === 'transactions' ? order : 'asc'}
                              onClick={(event) => handleRequestSort(event, 'transactions')}
                            >
                              Transactions
                            </TableSortLabel>
                          </TableCell>
                          <TableCell align="right">
                            <TableSortLabel
                              active={orderBy === 'totalAmount'}
                              direction={orderBy === 'totalAmount' ? order : 'asc'}
                              onClick={(event) => handleRequestSort(event, 'totalAmount')}
                            >
                              Total Amount ($)
                            </TableSortLabel>
                          </TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedData.map((row, index) => (
                            <TableRow
                            key={index}
                            sx={{
                                '&:hover': {
                                backgroundColor: '#E4F2FF',
                                },
                            }}
                            >
                            <TableCell component="th" scope="row">
                                {row.user}
                            </TableCell>
                            <TableCell align="right">{row.age}</TableCell>
                            <TableCell align="right">{row.transactions}</TableCell>
                            <TableCell align="right">{row.totalAmount}</TableCell>
                            <TableCell align="right">
                                <IconButton onClick={() => handleDownload(row,"DOCX")}>
                                <FaRegFileWord />
                                </IconButton>
                                <IconButton onClick={() => handleDownload(row,"PDF")}>
                                <FaRegFilePdf />
                                </IconButton>
                            </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={filteredData.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25]}
                  />
                </Box>
              }
            />
        </Grid>
      </Grid>

      <DialogForm
        title={dialogTitle}
        content=""
        open={dialogOpen}
        onClose={handleClose}
      />

    </div>
  )
}

export default DashboardView