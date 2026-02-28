import { Typography } from "@mui/material";
import React from "react";

const RequiredField = ({ asteriskColor = "red", variant = "body1", title, isRequired = true }) => {
  return (
    <Typography variant={variant} sx={{ color: 'gray' }}>
      <span>{title}</span>
      {isRequired && <span style={{ color: asteriskColor, fontWeight: 'bold' }}> *</span>}
    </Typography>
  );
};

export default RequiredField;