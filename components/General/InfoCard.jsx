import React from "react";
import { Card, CardContent, Typography, Grid, Box } from "@mui/material";

const InfoCard = ({ header, innerText }) => {
  return (
    <>
      <Box
        sx={{
          borderRadius: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            textAlign: "center",
            bgcolor: "#5b4689",
            mb: -2,
            zIndex: 1,
            py: 0.5,
            px: 5,
            borderRadius: 1,
          }}
        >
          <Typography
            variant="h3"
            component="h2"
            sx={{
              textAlign: "center",
              color: "white",
              fontSize: "1.2rem",
              fontWeight: 250,
              lineHeight: 1.2,
            }}
          >
            {header}
          </Typography>
        </Box>

        <Card sx={{ bgcolor: "white", width: "100%", textAlign: "center" }}>
          <CardContent>
            <Typography variant="h4">{innerText}</Typography>
          </CardContent>
        </Card>
      </Box>
    </>
  );
};

export default InfoCard;
