import React from 'react';
import {Accordion, AccordionDetails, AccordionSummary, Button, Typography} from "@material-ui/core";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import {connect, ConnectedProps} from "react-redux";
import {RootState} from "../../../store/reducer";
import {Dispatch} from "redux";
import Frontend from "./Frontend";
import './FrontendContainer.scss'
import {Add} from "@material-ui/icons";
import {frontendActions} from "../../../store/module/haproxy/action";

const mapStateToProps = (state: RootState) => ({
    frontends: state.haproxy.config?.frontends
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
     createFrontend: () => {
        dispatch(frontendActions.create())
     }
})

const connector = connect(mapStateToProps, mapDispatchToProps);
type ReduxTypes = ConnectedProps<typeof connector>;


function FrontendContainer(props: ReduxTypes) {

    const frontends = props.frontends ? Object.entries(props.frontends).map(([key, value]) => ({name: key, data: value})) : []

    return (
        <Accordion defaultExpanded={true}>
            <AccordionSummary
                expandIcon={<ExpandMoreIcon/>}
                aria-controls="panel1a-content"
                id="panel1a-header"
            >
                <Typography className={"title"}>Frontends</Typography>
            </AccordionSummary>
            <AccordionDetails className={"Frontend-container-details"}>
                <Button className={"create-btn"} color={"primary"} onClick={props.createFrontend}>Add <Add/></Button>
                {frontends.map(b => <Frontend data={b}/>)}
            </AccordionDetails>
        </Accordion>
    );
}

export default connector(FrontendContainer);
