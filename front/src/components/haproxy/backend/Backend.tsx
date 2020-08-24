import React, {Component} from 'react';
import {Core} from "../../../../../back/core/haproxy/types";


interface Props {
    data: {
        name: string,
        data: Core.Backend
    }
}


class Backend extends Component<Props> {
    render() {
        const {data: {data, name}} = this.props;
        return (
            <div>
                {name}
            </div>
        );
    }
}

export default Backend;
