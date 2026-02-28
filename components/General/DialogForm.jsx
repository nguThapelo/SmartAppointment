import React from 'react';
import { Dialog, DialogTitle, DialogContent, Divider, Box } from "@mui/material";
import HighlightOffIcon from '@mui/icons-material/HighlightOff';

const DialogForm = ({ title, content, open, onClose, width = "md" }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={width} fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          {title}
          <HighlightOffIcon
            aria-label="close"
            onClick={onClose}
            sx={{
              color: (theme) => theme.palette.grey[500],
              fontSize: 25,
              cursor: 'pointer',
            }}
          />
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent>
        {content}
      </DialogContent>
    </Dialog>
  );
};

export default DialogForm;