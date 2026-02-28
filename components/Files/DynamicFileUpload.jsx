import {
    CloudUpload,
    Delete,
    Description,
    ExpandMore,
    FilePresent,
    Info,
    PictureAsPdf,
    TableChart
} from "@mui/icons-material";
import {
    Alert,
    Box,
    Card,
    CardContent,
    Chip,
    Collapse,
    Divider,
    FormHelperText,
    IconButton,
    LinearProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Tooltip,
    Typography
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { apiInstance } from "@root/queries/axiosInstances";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);
const chunkSize = 100 * 1024;

const DropzoneContainer = styled(Paper)(({ theme, isDragActive, hasError }) => ({
    border: `2px dashed ${
        hasError 
            ? theme.palette.error.main 
            : isDragActive 
                ? theme.palette.primary.main 
                : theme.palette.grey[400]
    }`,
    borderRadius: theme.spacing(2),
    padding: theme.spacing(6),
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    backgroundColor: isDragActive 
        ? theme.palette.primary.main + '08' 
        : theme.palette.grey[50],
    '&:hover': {
        backgroundColor: theme.palette.grey[100],
        borderColor: theme.palette.primary.main,
        transform: 'translateY(-2px)',
        boxShadow: theme.shadows[4],
    },
    minHeight: '200px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
}));

const FilePreviewCard = styled(Card)(({ theme }) => ({
    marginBottom: theme.spacing(1),
    transition: 'all 0.2s ease',
    '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: theme.shadows[4],
    },
}));

const ProgressContainer = styled(Box)(({ theme }) => ({
    position: 'relative',
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[50],
    borderRadius: theme.spacing(1),
    marginTop: theme.spacing(2),
}));

const ALL_FILE_TYPES = {
    'application/pdf': { color: 'error', icon: PictureAsPdf, label: 'PDF', extension: '.pdf' },
    'application/msword': { color: 'info', icon: Description, label: 'DOC', extension: '.doc' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { color: 'info', icon: Description, label: 'DOCX', extension: '.docx' },
    'application/vnd.ms-excel': { color: 'success', icon: TableChart, label: 'XLS', extension: '.xls' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { color: 'success', icon: TableChart, label: 'XLSX', extension: '.xlsx' },
    'application/vnd.ms-excel.sheet.macroEnabled.12': { color: 'success', icon: TableChart, label: 'XLSM', extension: '.xlsm' },
};

const DynamicFileUpload = ({
    allowMultiple = true,
    handleClose,
    formData,
    touched,
    errors,
    name,
    triggerUpload,
    setTriggerUpload,
    readOnly = false,
    user,
    urLink,
    existingDocuments = [],
    refetchData,
    allowedFileTypes = Object.keys(ALL_FILE_TYPES),
}) => {
    const { emailAddress, userID } = user.user;
    const queryClient = useQueryClient();
    const [dropzoneActive, setDropzoneActive] = useState(false);
    const [files, setFiles] = useState([]);
    const [currentFileIndex, setCurrentFileIndex] = useState(null);
    const [lastUploadedFileIndex, setLastUploadedFileIndex] = useState(null);
    const [currentChunkIndex, setCurrentChunkIndex] = useState(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [isExpanded, setIsExpanded] = useState(true);

    // Get filtered file types based on allowedFileTypes prop
    const getFilteredFileTypes = () => {
        const filteredTypes = {};
        allowedFileTypes.forEach(type => {
            if (ALL_FILE_TYPES[type]) {
                filteredTypes[type] = ALL_FILE_TYPES[type];
            }
        });
        return filteredTypes;
    };

    const FILE_TYPES = getFilteredFileTypes();

    // Get accept attribute for input
    const getAcceptAttribute = () => {
        return allowedFileTypes.map(type => ALL_FILE_TYPES[type]?.extension).filter(Boolean).join(',');
    };

    // Get allowed file types description
    const getAllowedFileTypesDescription = () => {
        const labels = allowedFileTypes.map(type => ALL_FILE_TYPES[type]?.label).filter(Boolean);
        return labels.join(', ');
    };

    // Your existing functions - modified validateFiles to use allowedFileTypes prop
    function removeFile(index) {
        setFiles((prevFiles) => prevFiles.filter((file, i) => i !== index));
    }

    function validateFiles(newFiles) {
        const allowedFiles = newFiles.filter((file) => {
            const fileType = file.type;
            return allowedFileTypes.includes(fileType);
        });

        const duplicateFiles = newFiles.filter((file) =>
            existingDocuments.some((existingDoc) => existingDoc.TenderBidDoc === file.name)
        );

        if (duplicateFiles.length > 0) {
            let message = "The following files already exist:\n";
            duplicateFiles.forEach((file) => {
                message += `- ${file.name}\n`;
            });

            MySwal.fire({
                icon: "warning",
                title: "Duplicate File(s) Found",
                text: message,
            });

            return allowedFiles.filter(
                (file) => !duplicateFiles.includes(file)
            );
        }

        if (allowedFiles.length < newFiles.length) {
            let message =
                "The following issues were found with your file(s):\n";
            newFiles.forEach((file) => {
                if (!allowedFiles.includes(file)) {
                    const fileType = file.type;
                    const isAllowedType = allowedFileTypes.includes(fileType);

                    if (!isAllowedType) {
                        const allowedTypesText = getAllowedFileTypesDescription();
                        message +=
                            `- The file type is not supported. Only ${allowedTypesText} files are allowed.\n`;
                    }
                }
            });

            MySwal.fire({
                icon: "warning",
                title: "File Upload Issues",
                text: message,
            });
        }
        return allowedFiles;
    }

    function handleDrop(e) {
        e.preventDefault();
        setDropzoneActive(false);
        const newFiles = Array.from(e.dataTransfer.files);
        if (!allowMultiple && (newFiles.length > 1 || files.length > 0)) {
            MySwal.fire({
                icon: "warning",
                title: "Only one file can be uploaded",
                text: "Please select only one file.",
            });
            return;
        }
        const allowedFiles = validateFiles(newFiles);
        setFiles([...files, ...allowedFiles]);
    }

    function handleChange(e) {
        e.preventDefault();
        const newFiles = Array.from(e.target.files);

        if (!allowMultiple && (newFiles.length > 1 || files.length > 0)) {
            MySwal.fire({
                icon: "warning",
                title: "Only one file can be uploaded",
                text: "Please select only one file.",
            });
            return;
        }
        const allowedFiles = validateFiles(newFiles);
        setFiles([...files, ...allowedFiles]);
        e.target.value = '';
    }

    const readAndUploadCurrentChunk = useCallback(async () => {
        const reader = new FileReader();
        const file = files[currentFileIndex];

        if (!file) {
            return;
        }

        const from = currentChunkIndex * chunkSize;
        const to = from + chunkSize;
        const blob = file.slice(from, to);
        reader.onload = async (e) => await uploadChunk(e);
        reader.readAsDataURL(blob);
    }, [files, currentFileIndex, currentChunkIndex, uploadChunk]);

    const uploadChunk = useCallback(async (readerEvent) => {
        const file = files[currentFileIndex];

        const data = readerEvent.target.result;
        let vals = data.toString().split(",")[1]

        const params = new URLSearchParams();
        params.set("name", file.name);
        params.set("size", file.size);;
        params.set("currentChunkIndex", currentChunkIndex);
        params.set("totalChunks", Math.ceil(file.size / chunkSize));

        const headers = { "Content-Type": "application/octet-stream" };

        const url = urLink + params.toString()
        await apiInstance({
            url: url,
            method: "POST",
            data: { vals: vals },
            headers
        })
            .then(async (response) => {

                const file = files[currentFileIndex];
                const filesize = files[currentFileIndex].size;
                const chunks = Math.ceil(filesize / chunkSize) - 1;
                const isLastChunk = currentChunkIndex === chunks;
                if (isLastChunk) {
                    file.finalFilename = response.data;
                    const isLastFile = currentFileIndex === files.length - 1;
                    if (isLastFile) {
                        MySwal.fire({
                            className: 'swal2-popup',
                            icon: 'success',
                            title: "Added Successfully",
                            type: "success",
                            timer: 3500,
                            showCancelButton: false,
                            showConfirmButton: false
                        })
                        setFiles([]);
                        setCurrentFileIndex(null);
                        setLastUploadedFileIndex(null);
                        setCurrentChunkIndex(null);
                        setTriggerUpload(false);

                        if (typeof refetchData === "function") {
                            refetchData();
                        }
                        handleClose()
                    } else {
                        setCurrentFileIndex(currentFileIndex + 1);
                        setCurrentChunkIndex(0);
                    }
                } else {
                    setCurrentChunkIndex(currentChunkIndex + 1);
                }
            })
            .catch((error) => {
                MySwal.fire({
                    icon: "error",
                    html: `${error?.response?.data ? error?.response?.data : error
                        }`,
                });
            });
    }, [currentFileIndex, files, currentChunkIndex, urLink, setTriggerUpload, setFiles, setCurrentFileIndex, setLastUploadedFileIndex, setCurrentChunkIndex, refetchData, handleClose]);

    // Your existing useEffects - keeping them exactly the same
    useEffect(() => {
        if (lastUploadedFileIndex === null) {
            return;
        }
        const isLastFile = lastUploadedFileIndex === files.length - 1;
        const nextFileIndex = isLastFile ? null : currentFileIndex + 1;
        setCurrentFileIndex(nextFileIndex);
    }, [lastUploadedFileIndex, currentFileIndex, files.length]);

    useEffect(() => {
        if (files.length > 0) {
            if (currentFileIndex === null) {
                setCurrentFileIndex(
                    lastUploadedFileIndex === null
                        ? 0
                        : lastUploadedFileIndex + 1
                );
            }
        }
    }, [files.length, currentFileIndex, lastUploadedFileIndex]);

    useEffect(() => {
        if (currentFileIndex !== null) {
            setCurrentChunkIndex(0);
        }
    }, [currentFileIndex]);

    useEffect(() => {
        if (triggerUpload) {
            if (currentFileIndex === 0 && currentChunkIndex === 0) {
                MySwal.fire({
                    title: 'Submitting...',
                    allowOutsideClick: false,
                    didOpen: () => {
                        MySwal.showLoading();
                    }
                });
            }

            const file = files[currentFileIndex];
            if (file && file.size <= chunkSize) {
                readAndUploadCurrentChunk();
            } else if (currentChunkIndex !== null) {
                readAndUploadCurrentChunk();
            } else if (files.length === 0) {
                setTriggerUpload(false);
                handleClose()
            }
        }
    }, [triggerUpload, currentChunkIndex, files, currentFileIndex, handleClose, readAndUploadCurrentChunk, setTriggerUpload]);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Helper functions for modern UI
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileTypeInfo = (file) => {
        return FILE_TYPES[file.type] || { color: 'default', icon: FilePresent, label: 'FILE' };
    };

    const calculateUploadProgress = () => {
        if (!triggerUpload || currentFileIndex === null || files.length === 0) return 0;
        
        const totalFiles = files.length;
        const completedFiles = currentFileIndex;
        const currentFileProgress = currentChunkIndex !== null && files[currentFileIndex] 
            ? (currentChunkIndex / Math.ceil(files[currentFileIndex].size / chunkSize)) * 100 
            : 0;
        
        return ((completedFiles + currentFileProgress / 100) / totalFiles) * 100;
    };

    return (
        <Card 
            elevation={3} 
            sx={{ 
                borderRadius: 3, 
                overflow: 'visible',
                background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                border: '1px solid',
                borderColor: 'grey.200',
            }}
        >
            <CardContent sx={{ p: 3 }}>
                {/* Header */}
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <CloudUpload 
                            sx={{ 
                                fontSize: 32, 
                                color: 'primary.main',
                                background: 'white',
                                borderRadius: '50%',
                                p: 1,
                                boxShadow: 2,
                            }} 
                        />
                        <Box>
                            <Typography variant="h5" fontWeight="700" color="text.primary">
                                Document Upload
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Upload your documents here
                            </Typography>
                        </Box>
                        {files.length > 0 && (
                            <Chip 
                                label={`${files.length} file${files.length > 1 ? 's' : ''}`}
                                color="primary" 
                                size="small"
                                sx={{ 
                                    fontWeight: 600,
                                    '& .MuiChip-label': { px: 2 }
                                }}
                            />
                        )}
                    </Box>
                    
                    {files.length > 0 && (
                        <IconButton 
                            onClick={() => setIsExpanded(!isExpanded)}
                            sx={{ 
                                background: 'rgba(255,255,255,0.8)',
                                '&:hover': { background: 'rgba(255,255,255,1)' },
                                transition: 'all 0.2s ease',
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                            }}
                        >
                            <ExpandMore />
                        </IconButton>
                    )}
                </Box>

                {/* File type info - Dynamic based on allowed types */}
                <Alert 
                    severity="info" 
                    sx={{ 
                        mb: 3, 
                        borderRadius: 2,
                        background: 'rgba(33, 150, 243, 0.08)',
                        border: '1px solid rgba(33, 150, 243, 0.2)',
                    }}
                    icon={<Info />}
                >
                    <Typography variant="body2" fontWeight="500">
                        <strong>Supported formats:</strong> {getAllowedFileTypesDescription()}
                    </Typography>
                </Alert>

                {!Boolean(readOnly) && (
                    <>
                        {/* Modern Dropzone */}
                        <DropzoneContainer
                            component="label"
                            htmlFor={name}
                            isDragActive={dropzoneActive}
                            hasError={touched[name] && errors[name]}
                            onDragOver={(e) => {
                                setDropzoneActive(true);
                                e.preventDefault();
                            }}
                            onDragLeave={(e) => {
                                setDropzoneActive(false);
                                e.preventDefault();
                            }}
                            onDrop={handleDrop}
                            elevation={dropzoneActive ? 8 : 2}
                        >
                            <input
                                type="file"
                                id={name}
                                onChange={handleChange}
                                multiple={allowMultiple}
                                hidden
                                accept={getAcceptAttribute()}
                            />
                            
                            <CloudUpload 
                                sx={{ 
                                    fontSize: 64, 
                                    color: dropzoneActive ? 'primary.main' : 'grey.400',
                                    mb: 2,
                                    transition: 'all 0.3s ease'
                                }} 
                            />
                            
                            <Typography variant="h6" gutterBottom color="text.primary" fontWeight="600">
                                {dropzoneActive ? 'Drop files here' : 'Drop files here or click to browse'}
                            </Typography>
                            
                            <Typography variant="body2" color="text.secondary">
                                {allowMultiple ? 'Select multiple files' : 'Select a single file'}
                            </Typography>

                            {/* Show only allowed file type chips */}
                            <Box mt={2} display="flex" gap={1} flexWrap="wrap" justifyContent="center">
                                {Object.entries(FILE_TYPES).map(([type, info]) => {
                                    const IconComponent = info.icon;
                                    return (
                                        <Chip
                                            key={type}
                                            icon={<IconComponent />}
                                            label={info.label}
                                            variant="outlined"
                                            size="small"
                                            color={info.color}
                                        />
                                    );
                                })}
                            </Box>
                        </DropzoneContainer>

                        {/* Error message */}
                        {touched[name] && errors[name] && (
                            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                                {errors[name]?.value || errors[name]}
                            </Alert>
                        )}
                    </>
                )}

                {/* Upload Progress */}
                {triggerUpload && files.length > 0 && (
                    <ProgressContainer>
                        <Box display="flex" alignItems="center" gap={2} mb={2}>
                            <Typography variant="body2" fontWeight="600">
                                Uploading files... ({Math.round(calculateUploadProgress())}%)
                            </Typography>
                            {currentFileIndex !== null && files[currentFileIndex] && (
                                <Typography variant="body2" color="text.secondary">
                                    Current: {files[currentFileIndex].name}
                                </Typography>
                            )}
                        </Box>
                        <LinearProgress 
                            variant="determinate" 
                            value={calculateUploadProgress()}
                            sx={{ 
                                height: 8, 
                                borderRadius: 4,
                                backgroundColor: 'grey.200',
                                '& .MuiLinearProgress-bar': {
                                    borderRadius: 4,
                                }
                            }}
                        />
                    </ProgressContainer>
                )}

                {/* File list */}
                <Collapse in={isExpanded && files.length > 0}>
                    <Box mt={3}>
                        <Divider sx={{ mb: 3 }} />
                        
                        <Box display="flex" alignItems="center" gap={2} mb={2}>
                            <Typography variant="h6" fontWeight="600" color="text.primary">
                                Selected Files
                            </Typography>
                            <Chip 
                                label={files.length}
                                color="primary" 
                                size="small"
                            />
                        </Box>

                        {/* Modern File Table */}
                        <TableContainer 
                            component={Paper} 
                            elevation={2} 
                            sx={{ 
                                borderRadius: 2,
                                overflow: 'hidden',
                                border: '1px solid',
                                borderColor: 'grey.200',
                            }}
                        >
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: 'grey.50' }}>
                                        <TableCell sx={{ fontWeight: 700, py: 2 }}>File Details</TableCell>
                                        <TableCell sx={{ fontWeight: 700, py: 2 }}>Type</TableCell>
                                        <TableCell sx={{ fontWeight: 700, py: 2 }}>Size</TableCell>
                                        <TableCell sx={{ fontWeight: 700, py: 2, width: 120 }}>Action</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {files
                                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                        .map((file, index) => {
                                            const fileTypeInfo = getFileTypeInfo(file);
                                            const IconComponent = fileTypeInfo.icon;
                                            const actualIndex = page * rowsPerPage + index;
                                            
                                            return (
                                                <TableRow 
                                                    key={`${file.name}-${actualIndex}`} 
                                                    hover
                                                    sx={{
                                                        '&:hover': {
                                                            backgroundColor: 'rgba(33, 150, 243, 0.04)',
                                                        }
                                                    }}
                                                >
                                                    <TableCell sx={{ py: 2 }}>
                                                        <Box display="flex" alignItems="center" gap={2}>
                                                            <IconComponent 
                                                                color={fileTypeInfo.color}
                                                                sx={{ fontSize: 24 }}
                                                            />
                                                            <Box>
                                                                <Typography 
                                                                    variant="body2" 
                                                                    fontWeight="600"
                                                                    sx={{ 
                                                                        maxWidth: 300,
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                >
                                                                    {file.name}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    Added just now
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell sx={{ py: 2 }}>
                                                        <Chip 
                                                            label={fileTypeInfo.label}
                                                            color={fileTypeInfo.color}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ fontWeight: 600 }}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ py: 2 }}>
                                                        <Typography variant="body2" color="text.secondary" fontWeight="500">
                                                            {formatFileSize(file.size)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell sx={{ py: 2 }}>
                                                        <Tooltip title="Remove file">
                                                            <IconButton
                                                                onClick={() => removeFile(actualIndex)}
                                                                color="error"
                                                                size="small"
                                                                sx={{
                                                                    '&:hover': {
                                                                        backgroundColor: 'error.main',
                                                                        color: 'white',
                                                                        transform: 'scale(1.1)',
                                                                    },
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                            >
                                                                <Delete fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                </TableBody>
                            </Table>
                            
                            {files.length > rowsPerPage && (
                                <TablePagination
                                    rowsPerPageOptions={[5, 10, 25]}
                                    component="div"
                                    count={files.length}
                                    rowsPerPage={rowsPerPage}
                                    page={page}
                                    onPageChange={handleChangePage}
                                    onRowsPerPageChange={handleChangeRowsPerPage}
                                    sx={{
                                        backgroundColor: 'grey.50',
                                        borderTop: '1px solid',
                                        borderColor: 'grey.200',
                                    }}
                                />
                            )}
                        </TableContainer>
                    </Box>
                </Collapse>

                {/* Helper text for errors */}
                <FormHelperText
                    sx={{
                        color: "error.main !important",
                        marginLeft: "16px !important",
                        mt: 1,
                    }}
                >
                    {touched[name] && (errors[name]?.value || errors[name])}
                </FormHelperText>
            </CardContent>
        </Card>
    );
};

export default DynamicFileUpload;