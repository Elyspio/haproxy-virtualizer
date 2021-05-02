import {Box, CircularProgress, CircularProgressProps, Typography, TypographyVariant} from "@material-ui/core";
import React from "react";

export function CircularProgressWithLabel(props: CircularProgressProps & { label: string, variant?: TypographyVariant }) {
    return (
        <Box position="relative" display="inline-flex">
            <CircularProgress  {...props} />
            <Box
                top={0}
                left={0}
                bottom={0}
                right={0}
                position="absolute"
                display="flex"
                alignItems="center"
                justifyContent="center"
            >
                <Typography variant={props.variant ?? "caption"} component="div"
                            color="textSecondary">{props.label}</Typography>
            </Box>
        </Box>
    );
}
