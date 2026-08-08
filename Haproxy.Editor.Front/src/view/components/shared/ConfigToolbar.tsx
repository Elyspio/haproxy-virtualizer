import { Refresh, Save, Verified } from "@mui/icons-material";
import { Button, type ButtonProps, keyframes, Stack } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import React from "react";
import { InvalidConfiguration } from "@components/toasts/InvalidConfiguration";
import { useApplication } from "@/view/context/application.context";
import { useSaveConfig, useValidateConfig } from "@/core/api/mutations";
import { useDashboardQuery } from "@/core/api/queries";

const GLOW_DURATION_MS = 1500;

const successGlow = keyframes`
	0%   { box-shadow: 0 0 0 0 var(--glow-color); }
	40%  { box-shadow: 0 0 12px 4px var(--glow-color); }
	100% { box-shadow: 0 0 0 0 var(--glow-color); }
`;

function glowSx(success: boolean, color: string): ButtonProps["sx"] {
	if (!success) return undefined;
	return {
		"--glow-color": color,
		animation: `${successGlow} ${GLOW_DURATION_MS}ms ease-out`,
		borderColor: color,
	} as ButtonProps["sx"];
}

export function ConfigToolbar() {
	const theme = useTheme();
	const { snapshot, setSnapshot } = useApplication();
	const saveMutation = useSaveConfig();
	const validateMutation = useValidateConfig();
	const dashboard = useDashboardQuery();
	const [saveSucceeded, setSaveSucceeded] = useState(false);
	const [validateSucceeded, setValidateSucceeded] = useState(false);
	const [refreshSucceeded, setRefreshSucceeded] = useState(false);
	const glowColor = alpha(theme.palette.success.main, 0.6);

	useEffect(() => {
		if (!saveSucceeded && !validateSucceeded && !refreshSucceeded) return;
		const timeout = window.setTimeout(() => {
			setSaveSucceeded(false);
			setValidateSucceeded(false);
			setRefreshSucceeded(false);
		}, GLOW_DURATION_MS);
		return () => window.clearTimeout(timeout);
	}, [refreshSucceeded, saveSucceeded, validateSucceeded]);

	const save = useCallback(() => {
		void saveMutation
			.mutateAsync(snapshot)
			.then((saved) => {
				setSnapshot(saved);
				setSaveSucceeded(true);
			})
			.catch((error: Error) => toast.error(React.createElement(InvalidConfiguration, { errorMsg: error.message }), { style: { width: 500 }, hideProgressBar: true }));
	}, [saveMutation, setSnapshot, snapshot]);

	const verify = useCallback(() => {
		void validateMutation.mutateAsync(snapshot).then((result) => {
			if (result.success) setValidateSucceeded(true);
			else toast.error(React.createElement(InvalidConfiguration, { errorMsg: result.error }), { style: { width: 500 }, hideProgressBar: true });
		});
	}, [snapshot, validateMutation]);

	const refresh = useCallback(() => {
		void dashboard.refetch().then(() => setRefreshSucceeded(true));
	}, [dashboard]);

	return (
		<Stack spacing={1} direction={"row"} alignItems={"center"} height={"100%"}>
			<Button
				variant="outlined"
				size="small"
				startIcon={<Refresh fontSize="small" />}
				onClick={refresh}
				disabled={dashboard.isFetching}
				sx={glowSx(refreshSucceeded, glowColor)}
			>
				Refresh
			</Button>
			<Button
				variant="outlined"
				size="small"
				startIcon={<Verified fontSize="small" />}
				onClick={verify}
				disabled={validateMutation.isPending}
				sx={glowSx(validateSucceeded, glowColor)}
			>
				Validate
			</Button>
			<Button variant="contained" size="small" startIcon={<Save fontSize="small" />} onClick={save} disabled={saveMutation.isPending} sx={glowSx(saveSucceeded, glowColor)}>
				Save
			</Button>
		</Stack>
	);
}
