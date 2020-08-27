import React, {ReactNode} from 'react';
import './Login.scss'
import {Button, Modal, Paper, Snackbar, TextField, Typography} from "@material-ui/core";
import {Alert} from "@material-ui/lab";
import {AccountApi} from "../../../api/account";


interface Props {
    onAuthorized?: Function,
    onForbidden?: Function,
    children: ReactNode
}


function Login(props: Props) {

    const [open, setOpen] = React.useState(false);
    const [password, setMdp] = React.useState("")
    const [name, setName] = React.useState("")
    const [snack, setSnack] = React.useState({
        open: false,
        message: "",
        severity: ""
    });

    const submit = async () => {

        if (await AccountApi.instance.isAuthorized({name, password})) {

            if (props.onAuthorized) {
                props.onAuthorized();
            }

            setSnack({
                ...snack,
                open: true,
                message: "OK",
                severity: "success"
            })
        } else {
            setSnack({
                ...snack,
                open: true,
                message: "Vous n'êtes pas autorisé à faire cette action",
                severity: "error"
            })

            if (props.onForbidden) {
                props.onForbidden();
            }
        }

        setOpen(false);
        setMdp("")
        // setName("")


    }


    const body = (
        <Paper className={"login-body"} onKeyDown={e => e.keyCode === 13 && submit()}>

            <Typography variant={"h6"}>Login</Typography>

            <TextField
                id={"login-name"}
                label="Name"
                value={name}
                onChange={e => setName(e.target.value)}/>

            <TextField
                id={"login-password"}
                label="Password"
                value={password}
                type={"password"}
                onChange={e => setMdp(e.target.value)}/>

            <Button color={"primary"} type={"submit"} onClick={submit}>Submit</Button>

        </Paper>
    );

    return (
        <div className={"login"}>
            <Button color={"primary"} variant={"outlined"} onClick={() => setOpen(true)}>
                {props.children}
            </Button>

            <Snackbar open={snack.open} autoHideDuration={6000} onClose={() => setSnack({...snack, open: false})} anchorOrigin={{horizontal: "center", vertical: "bottom"}}>
                <Alert onClose={() => setSnack({...snack, open: false})} severity={snack.severity as any}>
                    {snack.message}
                </Alert>
            </Snackbar>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                aria-labelledby="simple-modal-title"
                aria-describedby="simple-modal-description"
            >
                {body}
            </Modal>
        </div>
    );
}

export default Login;
