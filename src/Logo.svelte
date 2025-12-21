<script lang="ts">
const asciiArt = `
   @@@@@@@    @@@@@@   @@@  @@@  @@@  @@@@@@@
   @@@@@@@@  @@@@@@@@  @@@@ @@@   @@  @@@@@@@
   @@!  @@@  @@!  @@@  @@!@!@@@  @!     @@!
   !@!  @!@  !@!  @!@  !@!!@!@!         !@!
   @!@  !@!  @!@  !@!  @!@ !!@!         @!!
   !@!  !!!  !@!  !!!  !@!  !!!         !!!
   !!:  !!!  !!:  !!!  !!:  !!!         !!:
   :!:  !:!  :!:  !:!  :!:  !:!         :!:
    :::: ::  ::::: ::   ::   ::          ::
   :: :  :    : :  :   ::    :           :


   @@@@@@@    @@@@@@   @@@  @@@  @@@   @@@@@@@  @@@
   @@@@@@@@  @@@@@@@@  @@@@ @@@  @@@  @@@@@@@@  @@@
   @@!  @@@  @@!  @@@  @@!@!@@@  @@!  !@@       @@!
   !@!  @!@  !@!  @!@  !@!!@!@!  !@!  !@!       !@
   @!@@!@!   @!@!@!@!  @!@ !!@!  !!@  !@!       @!@
   !!@!!!    !!!@!!!!  !@!  !!!  !!!  !!!       !!!
   !!:       !!:  !!!  !!:  !!!  !!:  :!!
   :!:       :!:  !:!  :!:  !:!  :!:  :!:       :!:
    ::       ::   :::   ::   ::   ::   ::: :::   ::
    :         :   : :  ::    :   :     :: :: :  :::
`;

const asciiArtSmall = `
@@@@@@@   @@@@@@  @@@  @@@ @@@ @@@@@@@
@@!  @@@ @@!  @@@ @@!@!@@@ !@    @!!
@!@  !@! @!@  !@! @!@@!!@!       @!!
!!:  !!! !!:  !!! !!:  !!!       !!:
:: :  :   : :. :  ::    :         :


@@@@@@@   @@@@@@  @@@  @@@ @@@  @@@@@@@ @@@
@@!  @@@ @@!  @@@ @@!@!@@@ @@! !@@      @@@
@!@@!@!  @!@!@!@! @!@@!!@! !!@ !@!      !@!
!!:      !!:  !!! !!:  !!! !!: :!!
 :        :   : : ::    :  :    :: :: : :.:
`;
</script>

<a href="/item/towel" class="logo-link">
  <aside class="ascii-art-container large">
    <pre class="ascii-art">{asciiArt}</pre>
  </aside>
  <div class="ascii-art-container small">
    <pre class="ascii-art">{asciiArtSmall}</pre>
  </div>
</a>

<style>
.ascii-art {
  font-family: Unifont, monospace;
  font-size: 8px;
  line-height: 1;
  color: var(--cata-color-light_cyan);
  background: transparent;
  border: none;
  margin: 0;
  padding: 0;
  white-space: pre;
}

.logo-link:hover {
  text-decoration: none;
}

.ascii-art-container.large {
  float: right;
}

.ascii-art-container.small {
  text-align: center;
  margin-bottom: 1em;
  margin-left: 1em;
}

@media (max-width: 600px) {
  .ascii-art-container.large {
    display: none;
  }
}

@media (min-width: 601px) {
  .ascii-art-container.small {
    display: none;
  }
}
</style>
