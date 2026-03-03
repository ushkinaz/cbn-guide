<script lang="ts">
import { setContext } from "svelte";
import { createLiveContextProxy } from "./contextProxy";

interface Props {
  Component: any;
  data: any;
  [key: string]: any;
}

let { Component, data, ...rest }: Props = $props();
const dataContext = createLiveContextProxy(() => data);

setContext("data", dataContext);
</script>

<Component {...rest} />
