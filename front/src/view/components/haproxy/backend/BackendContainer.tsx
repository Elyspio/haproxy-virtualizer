import React from 'react';
import {Accordion, AccordionDetails, AccordionSummary, Button, Typography} from "@material-ui/core";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import {connect, ConnectedProps} from "react-redux";
import {Dispatch} from "redux";
import Backend from "./Backend";
import useTheme from "@material-ui/core/styles/useTheme";
import {Add} from "@material-ui/icons";
import {backendActions} from "../../../../store/module/haproxy/action";
import "./BackendContainer.scss"
import {joinComponent} from "../../utils/Utils";
import {StoreState} from "../../../../store";

const mapStateToProps = (state: StoreState) => ({
    backends: state.haproxy.config?.backends,
    theme: state.theme.current
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
    createBackend: (e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch(backendActions.create())
    }

})
const connector = connect(mapStateToProps, mapDispatchToProps);
type ReduxTypes = ConnectedProps<typeof connector>;


function BackendContainer(props: ReduxTypes) {

    const backends = props.backends ? Object.entries(props.backends).map(([key, value]) => ({
        name: key,
        data: value
    })) : []
    const theme = useTheme();
    const {text} = theme.palette;

    return (
        <Accordion defaultExpanded={true}>
            <AccordionSummary
                expandIcon={<ExpandMoreIcon/>}
                aria-controls="panel1a-content"
                id="panel1a-header"
                style={{
                    color: text.primary
                }}
            >
                <Typography className={"title"}>Backends <Button className={"create-btn"} color={"primary"}
                                                                 onClick={props.createBackend}>Add <Add/></Button></Typography>
            </AccordionSummary>
            <AccordionDetails className={"Backend-container-details"}>
                {joinComponent("divider", ...backends.map((b, i) => <Backend key={i} data={b}/>))}
            </AccordionDetails>
        </Accordion>
    );
}

export default connector(BackendContainer);
