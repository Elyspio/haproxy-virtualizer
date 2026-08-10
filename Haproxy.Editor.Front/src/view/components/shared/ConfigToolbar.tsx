import { Refresh, Save, Verified } from "@mui/icons-material";
import { Alert, Button, type ButtonProps, keyframes, Stack } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import React from "react";
import { InvalidConfiguration } from "@components/toasts/InvalidConfiguration";
import { useConfigurationDraft } from "@/view/context/configuration-draft.context";
import { useSaveConfig, useValidateConfig } from "@/core/api/mutations";
import { useDashboardQuery } from "@/core/api/queries";

const GLOW_DURATION_MS = 1500;

type ConfigToolbarProps = {
	variant?: "all" | "refresh" | "commit";
	commitDisabled?: boolean;
};

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

export function ConfigToolbar({ variant = "all", commitDisabled = false }: Readonly<ConfigToolbarProps>) {
	const theme = useTheme();
	const { snapshot, hasUnsavedChanges, isDraftLocked, captureSnapshotForSave, completeSave, abortSave } = useConfigurationDraft();
	const saveMutation = useSaveConfig();
	const validateMutation = useValidateConfig();
	const dashboard = useDashboardQuery();
	const [saveSucceeded, setSaveSucceeded] = useState(false);
	const [validateSucceeded, setValidateSucceeded] = useState(false);
	const [refreshSucceeded, setRefreshSucceeded] = useState(false);
	const [refreshError, setRefreshError] = useState<string | null>(null);
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
		const submittedSnapshot = captureSnapshotForSave();
		if (!submittedSnapshot) {
			return;
		}

		void saveMutation
			.mutateAsync(submittedSnapshot)
			.then((saved) => {
				completeSave(saved);
				setSaveSucceeded(true);
			})
			.catch((error: Error) => {
				abortSave();
				toast.error(React.createElement(InvalidConfiguration, { errorMsg: error.message }), { style: { width: 500 }, hideProgressBar: true });
			});
	}, [abortSave, captureSnapshotForSave, completeSave, saveMutation]);

	const verify = useCallback(() => {
		void validateMutation.mutateAsync(snapshot).then((result) => {
			if (result.success) setValidateSucceeded(true);
			else toast.error(React.createElement(InvalidConfiguration, { errorMsg: result.error }), { style: { width: 500 }, hideProgressBar: true });
		});
	}, [snapshot, validateMutation]);

	const refresh = useCallback(() => {
		setRefreshError(null);
		setRefreshSucceeded(false);
		void dashboard
			.refetch()
			.then((result) => {
				if (result.isError) {
					throw result.error;
				}
				setRefreshSucceeded(true);
			})
			.catch(() => setRefreshError("Dashboard refresh failed. Try again."));
	}, [dashboard]);

	return (
		<Stack spacing={1} direction={"row"} alignItems={"center"} height={"100%"}>
			{refreshError ? (
				<Alert severity="error" sx={{ py: 0 }}>
					{refreshError}
				</Alert>
			) : null}
			{variant === "all" || variant === "refresh" ? (
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
			) : null}
			{variant === "all" || variant === "commit" ? (
				<>
					<Button
						variant="outlined"
						size="small"
						startIcon={<Verified fontSize="small" />}
						onClick={verify}
						disabled={!hasUnsavedChanges || commitDisabled || validateMutation.isPending || isDraftLocked}
						sx={glowSx(validateSucceeded, glowColor)}
					>
						Validate
					</Button>
					<Button
						variant="contained"
						size="small"
						startIcon={<Save fontSize="small" />}
						onClick={save}
						disabled={!hasUnsavedChanges || commitDisabled || saveMutation.isPending || isDraftLocked}
						sx={glowSx(saveSucceeded, glowColor)}
					>
						Save
					</Button>
				</>
			) : null}
		</Stack>
	);
}
